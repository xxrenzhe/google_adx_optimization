import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { createClient } from 'redis'
import { generateSessionId } from '../../../lib/session'

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

    // Create UNLOGGED table for faster bulk inserts
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

    // Process file with optimized streaming
    const result = await processLargeFile(file, tempTableName, sessionId, redisConnected)
    
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
    // Clean up connections
    await prisma.$disconnect()
    if (redisConnected) {
      await redis.disconnect().catch(() => {
        // Ignore disconnect errors
      })
    }
  }
}

// Optimized file processing for large files
async function processLargeFile(
  file: File, 
  tempTableName: string, 
  sessionId: string,
  redisConnected: boolean
): Promise<{ recordCount: number }> {
  let recordCount = 0
  const batchSize = 25000 // Reduced batch size for stability
  let batch: any[] = []
  let buffer = ''
  
  const stream = file.stream()
  const reader = stream.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: false })
  
  let headers: string[] = []
  let isFirstChunk = true
  let lastProgressUpdate = 0
  let totalBytesProcessed = 0
  
  try {
    while (true) {
      const { done, value } = await reader.read()
      
      if (done) {
        // Process remaining buffer
        if (buffer.trim()) {
          const line = buffer.trim()
          if (line && !isFirstChunk) {
            processCsvLine(line, headers, batch)
            recordCount++
          }
        }
        break
      }
      
      totalBytesProcessed += value.length
      buffer += decoder.decode(value, { stream: true })
      
      // Process complete lines
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (isFirstChunk) {
          // Parse headers from first line
          headers = parseCsvLine(line)
          isFirstChunk = false
          continue
        }
        
        if (line.trim()) {
          processCsvLine(line.trim(), headers, batch)
          recordCount++
          
          // Insert batch when it reaches the batch size
          if (batch.length >= batchSize) {
            await insertBatchWithRetry(prisma, tempTableName, batch)
            batch = []
            
            // Update progress less frequently
            const now = Date.now()
            if (redisConnected && now - lastProgressUpdate > 30000) { // Update every 30 seconds
              await redis.set(`upload_progress:${sessionId}`, JSON.stringify({
                processed: recordCount,
                totalBytes: totalBytesProcessed,
                progress: 'Processing...'
              })).catch(() => {
                // Ignore cache errors
              })
              lastProgressUpdate = now
            }
          }
        }
      }
    }
    
    // Insert remaining records
    if (batch.length > 0) {
      await insertBatchWithRetry(prisma, tempTableName, batch)
    }
    
    return { recordCount }
    
  } catch (error) {
    console.error('Stream processing error:', error)
    throw error
  }
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

// Process a single CSV line
function processCsvLine(line: string, headers: string[], batch: any[]) {
  const values = parseCsvLine(line)
  
  if (values.length !== headers.length) return
  
  // Map to database record
  const record = mapCsvToRecord(headers, values)
  if (record) {
    batch.push(record)
  }
}

// Map CSV columns to database fields
function mapCsvToRecord(headers: string[], values: string[]) {
  const record: any = {}
  
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
  
  // Map each column
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]
    const field = columnMap[header] || header
    const value = values[i]
    
    if (field === 'dataDate') {
      record.dataDate = new Date(value)
    } else if (['requests', 'impressions', 'clicks', 'viewableImpressions', 'measurableImpressions'].includes(field)) {
      record[field] = parseInt(value.replace(/,/g, '')) || 0
    } else if (['ctr', 'ecpm', 'revenue', 'viewabilityRate'].includes(field)) {
      record[field] = parseFloat(value.replace(/,/g, '')) || 0
    } else {
      record[field] = value
    }
  }
  
  // Calculate derived fields
  if (record.impressions && record.requests) {
    record.fillRate = record.impressions / record.requests
  }
  
  if (record.revenue && record.impressions) {
    record.arpu = record.revenue / record.impressions * 1000
  }
  
  return record
}

// Batch insert with retry logic
async function insertBatchWithRetry(
  prisma: PrismaClient, 
  tableName: string, 
  batch: any[],
  maxRetries: number = 3
): Promise<void> {
  let attempt = 0
  
  while (attempt < maxRetries) {
    try {
      // Use smaller batches to avoid parameter limits
      const chunkSize = 1000
      for (let i = 0; i < batch.length; i += chunkSize) {
        const chunk = batch.slice(i, i + chunkSize)
        await insertBatchChunk(prisma, tableName, chunk)
      }
      return
    } catch (error) {
      attempt++
      console.warn(`Batch insert failed (attempt ${attempt}/${maxRetries}):`, error.message)
      
      if (attempt === maxRetries) {
        throw error
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
    }
  }
}

// Insert a chunk of records
async function insertBatchChunk(prisma: PrismaClient, tableName: string, chunk: any[]): Promise<void> {
  const values = chunk.map(record => [
    record.dataDate,
    record.website,
    record.country,
    record.adFormat,
    record.adUnit,
    record.advertiser,
    record.domain,
    record.device,
    record.browser,
    record.requests || 0,
    record.impressions || 0,
    record.clicks || 0,
    record.ctr || 0,
    record.ecpm || 0,
    record.revenue || 0,
    record.viewableImpressions || 0,
    record.viewabilityRate || 0,
    record.measurableImpressions || 0,
    record.fillRate || 0,
    record.arpu || 0
  ])
  
  await prisma.$executeRawUnsafe(`
    INSERT INTO ${tableName} (
      dataDate, website, country, adFormat, adUnit, advertiser, domain,
      device, browser, requests, impressions, clicks, ctr, ecpm, revenue,
      viewableImpressions, viewabilityRate, measurableImpressions, fillRate, arpu
    ) VALUES ${values.map((_, i) => `(
      $${i * 20 + 1}, $${i * 20 + 2}, $${i * 20 + 3}, $${i * 20 + 4}, $${i * 20 + 5}, 
      $${i * 20 + 6}, $${i * 20 + 7}, $${i * 20 + 8}, $${i * 20 + 9}, $${i * 20 + 10},
      $${i * 20 + 11}, $${i * 20 + 12}, $${i * 20 + 13}, $${i * 20 + 14}, $${i * 20 + 15},
      $${i * 20 + 16}, $${i * 20 + 17}, $${i * 20 + 18}, $${i * 20 + 19}, $${i * 20 + 20}
    )`).join(', ')}
  `, values.flat())
}