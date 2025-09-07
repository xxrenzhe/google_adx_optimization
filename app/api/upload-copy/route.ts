import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { createClient } from 'redis'
import { generateSessionId } from '../../../lib/session'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// Create a new Prisma client for this request with longer timeout
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '&connect_timeout=60&pool_timeout=120'
    }
  }
})

// Redis client for caching
const redis = createClient({
  url: process.env.REDIS_URL || '',
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500),
    connectTimeout: 30000,
    keepAlive: 30000
  }
})

export async function POST(request: NextRequest) {
  let redisConnected = false
  let tempFilePath = ''
  
  try {
    // Connect to Redis
    await redis.connect().catch(() => {
      console.warn('Redis connection failed, continuing without cache')
    })
    redisConnected = true
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'Only CSV files are allowed' }, { status: 400 })
    }

    console.log(`Starting upload of ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)

    // Create upload session record
    const sessionId = generateSessionId()
    const tempTableName = `temp_ad_data_${sessionId.replace(/[^a-zA-Z0-9_]/g, '_')}`
    
    // Validate table name format
    if (!/^[a-zA-Z_][a-zA-Z0-9_]{1,60}$/.test(tempTableName)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 })
    }
    
    const uploadSession = await prisma.uploadSession.create({
      data: {
        id: sessionId,
        filename: file.name,
        fileSize: file.size,
        tempTableName,
        status: 'uploading'
      }
    })

    // Create UNLOGGED table for faster bulk loads
    await prisma.$executeRawUnsafe(`
      CREATE UNLOGGED TABLE ${tempTableName} (
        id SERIAL PRIMARY KEY,
        dataDate DATE,
        website VARCHAR(500),
        country VARCHAR(100),
        adFormat VARCHAR(200),
        adUnit VARCHAR(500),
        advertiser VARCHAR(500),
        domain VARCHAR(500),
        device VARCHAR(100),
        browser VARCHAR(100),
        requests BIGINT,
        impressions BIGINT,
        clicks BIGINT,
        ctr DECIMAL(10, 4),
        ecpm DECIMAL(15, 6),
        revenue DECIMAL(15, 6),
        viewableImpressions BIGINT,
        viewabilityRate DECIMAL(10, 4),
        measurableImpressions BIGINT,
        fillRate DECIMAL(10, 4),
        arpu DECIMAL(15, 6)
      )
    `)

    // Process file using COPY command
    const result = await processFileWithCopy(file, tempTableName, sessionId, redisConnected)
    
    // Create indexes after data load
    console.log('Creating indexes...')
    await prisma.$executeRawUnsafe(`CREATE INDEX ON ${tempTableName} (dataDate)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX ON ${tempTableName} (website)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX ON ${tempTableName} (country)`)
    
    // Update session status
    await prisma.uploadSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        recordCount: result.recordCount,
        uploadedAt: new Date()
      }
    })
    
    // Cache session info if Redis is available
    if (redisConnected) {
      await redis.setEx(`session:${sessionId}`, 3600, JSON.stringify({
        id: sessionId,
        filename: file.name,
        recordCount: result.recordCount,
        tempTableName
      })).catch(() => {
        // Ignore cache errors
      })
    }
    
    console.log(`Upload completed successfully: ${result.recordCount} records`)
    
    return NextResponse.json({
      sessionId,
      filename: file.name,
      recordCount: result.recordCount,
      message: 'File uploaded successfully'
    })
    
  } catch (error) {
    console.error('Upload error:', error)
    
    // Try to update session status to failed
    try {
      const sessionId = request.headers.get('x-session-id') || 'unknown'
      await prisma.uploadSession.update({
        where: { id: sessionId },
        data: { status: 'failed', errorMessage: error.message }
      })
    } catch (e) {
      // Ignore update errors
    }
    
    return NextResponse.json(
      { error: 'Failed to process file', details: error.message },
      { status: 500 }
    )
  } finally {
    // Clean up temporary file
    if (tempFilePath && existsSync(tempFilePath)) {
      try {
        await unlink(tempFilePath)
        console.log('Temporary file cleaned up')
      } catch (e) {
        console.warn('Failed to clean up temporary file:', e)
      }
    }
    
    // Clean up connections
    await prisma.$disconnect()
    if (redisConnected) {
      await redis.disconnect().catch(() => {
        // Ignore disconnect errors
      })
    }
  }
}

// Process file using PostgreSQL COPY command for maximum performance
async function processFileWithCopy(
  file: File, 
  tempTableName: string, 
  sessionId: string,
  redisConnected: boolean
): Promise<{ recordCount: number }> {
  // Ensure temp directory exists
  const tempDir = '/tmp/csv_uploads'
  if (!existsSync(tempDir)) {
    await mkdir(tempDir, { recursive: true })
  }
  
  // Save file to disk temporarily
  tempFilePath = join(tempDir, `${sessionId}-${file.name}`)
  const fileBuffer = Buffer.from(await file.arrayBuffer())
  await writeFile(tempFilePath, fileBuffer)
  
  console.log(`File saved to temporary path: ${tempFilePath}`)
  
  // Read the first line to get headers and map to database columns
  const headerLine = fileBuffer.toString('utf-8').split('\n')[0]
  const headers = parseCsvLine(headerLine)
  
  // Map CSV headers to database column names
  const columnMap: Record<string, string> = {
    '网站': 'website',
    'Website': 'website',
    '国家/地区': 'country',
    'Country': 'country',
    '广告资源格式': 'adFormat',
    'Ad format': 'adFormat',
    '广告单元（所有级别）': 'adUnit',
    'Ad unit': 'adUnit',
    '广告客户（已分类）': 'advertiser',
    'Advertiser': 'advertiser',
    '广告客户网域': 'domain',
    'Advertiser domain': 'domain',
    '设备': 'device',
    'Device': 'device',
    '浏览器': 'browser',
    'Browser': 'browser',
    '日期': 'dataDate',
    'Date': 'dataDate',
    'Ad Exchange 请求总数': 'requests',
    'Ad requests': 'requests',
    'Ad Exchange 展示次数': 'impressions',
    'Ad impressions': 'impressions',
    'Ad Exchange 点击次数': 'clicks',
    'Ad clicks': 'clicks',
    'Ad Exchange 点击率': 'ctr',
    'Ad ctr': 'ctr',
    'Ad Exchange 平均 eCPM': 'ecpm',
    'Ad eCPM': 'ecpm',
    'Ad Exchange 收入': 'revenue',
    'Ad revenue': 'revenue',
    'Ad Exchange Active View可见展示次数': 'viewableImpressions',
    'Active view viewable impressions': 'viewableImpressions',
    'Ad Exchange Active View可见展示次数百分比': 'viewabilityRate',
    'Active view viewable percentage': 'viewabilityRate',
    'Ad Exchange Active View可衡量展示次数': 'measurableImpressions',
    'Active view measurable impressions': 'measurableImpressions'
  }
  
  // Build column list for COPY command
  const columns = headers
    .map(header => columnMap[header] || header)
    .filter(col => [
      'dataDate', 'website', 'country', 'adFormat', 'adUnit', 'advertiser', 
      'domain', 'device', 'browser', 'requests', 'impressions', 'clicks', 
      'ctr', 'ecpm', 'revenue', 'viewableImpressions', 'viewabilityRate', 
      'measurableImpressions'
    ].includes(col))
  
  console.log('Starting COPY command import...')
  
  // Use COPY command for bulk import
  await prisma.$executeRawUnsafe(`
    COPY ${tempTableName} (${columns.join(', ')})
    FROM '${tempFilePath}'
    WITH (FORMAT CSV, HEADER, DELIMITER ',', ENCODING 'UTF8')
  `)
  
  // Get record count
  const countResult = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) as count FROM ${tempTableName}
  `) as any[]
  
  const recordCount = parseInt(countResult[0]?.count || '0')
  
  console.log(`COPY completed: ${recordCount} records imported`)
  
  return { recordCount }
}

// Parse CSV line handling quoted fields
function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped quote
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current) // Add last field
  return result
}