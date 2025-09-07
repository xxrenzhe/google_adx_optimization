import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Readable } from 'stream'
import { createClient } from 'redis'
import { generateSessionId } from '@/lib/session'

// Redis client for caching
const redis = createClient({
  url: process.env.REDIS_URL || '',
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500)
  }
})

// Connect to Redis
redis.on('error', (err) => console.log('Redis Client Error', err))
redis.connect().catch(console.error)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'Only CSV files are allowed' }, { status: 400 })
    }

    // Create upload session record
    const sessionId = generateSessionId()
    // Safe table name generation to prevent SQL injection
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

    // Process file stream with optimized batch size
    let recordCount = 0
    const batchSize = 100000 // Increased batch size for better performance
    let batch: any[] = []
    
    const stream = file.stream()
    const reader = stream.getReader()
    const decoder = new TextDecoder('utf-8', { fatal: false })
    
    let headers: string[] = []
    let isFirstRow = true
    let lastProgressUpdate = 0
    
    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          break
        }
        
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim()
          if (!line) continue
          
          if (isFirstRow) {
            // Parse headers
            headers = line.split(',').map(h => h.trim().replace(/^"|"$/g, ''))
            isFirstRow = false
            continue
          }
          
          // Parse CSV row (simple approach)
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
          if (values.length !== headers.length) continue
          
          // Map columns to database fields
          const record = mapCsvToRecord(headers, values)
          if (record) {
            batch.push(record)
            recordCount++
            
            // Insert batch when it reaches the batch size
            if (batch.length >= batchSize) {
              await insertBatch(tempTableName, batch)
              batch = []
              
              // Update progress less frequently to reduce Redis overhead
              const now = Date.now()
              if (now - lastProgressUpdate > 5000) { // Update every 5 seconds
                await redis.set(`upload_progress:${sessionId}`, JSON.stringify({
                  processed: recordCount,
                  total: file.size,
                  progress: (recordCount * 100 / (file.size / 1000)).toFixed(1) // Rough estimate
                }))
                lastProgressUpdate = now
              }
            }
          }
        }
      }
      
      // Insert remaining records
      if (batch.length > 0) {
        await insertBatch(tempTableName, batch)
      }
      
      // Create indexes after data load for faster bulk inserts
      await createIndexes(tempTableName)
      
      // Update session status
      await prisma.uploadSession.update({
        where: { id: sessionId },
        data: {
          status: 'completed',
          recordCount,
          uploadedAt: new Date()
        }
      })
      
      // Cache session info
      await redis.setex(`session:${sessionId}`, 3600, JSON.stringify({
        id: sessionId,
        filename: file.name,
        recordCount,
        tempTableName
      }))
      
      return NextResponse.json({
        sessionId,
        filename: file.name,
        recordCount,
        message: 'File uploaded successfully'
      })
      
    } catch (error) {
      console.error('Upload processing error:', error)
      
      // Update session status to failed
      await prisma.uploadSession.update({
        where: { id: sessionId },
        data: { status: 'failed' }
      })
      
      return NextResponse.json(
        { error: 'Failed to process file' },
        { status: 500 }
      )
    }
    
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    )
  }
}

// Helper function to map CSV columns to database fields
function mapCsvToRecord(headers: string[], values: string[]) {
  const record: any = {}
  
  // Column mapping (Chinese and English column names)
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
      record[field] = parseInt(value) || 0
    } else if (['ctr', 'ecpm', 'revenue', 'viewabilityRate'].includes(field)) {
      record[field] = parseFloat(value) || 0
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

// Optimized batch insert using parameterized query
async function insertBatch(tableName: string, batch: any[]) {
  const values = batch.map(record => [
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

// Create indexes after data load for better performance
async function createIndexes(tableName: string) {
  await prisma.$executeRawUnsafe(`CREATE INDEX ON ${tableName} (dataDate)`)
  await prisma.$executeRawUnsafe(`CREATE INDEX ON ${tableName} (website)`)
  await prisma.$executeRawUnsafe(`CREATE INDEX ON ${tableName} (country)`)
}