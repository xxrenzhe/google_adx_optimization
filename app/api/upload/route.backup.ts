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

    // Create temporary table for this upload
    await prisma.$executeRawUnsafe(`
      CREATE TEMP TABLE ${tempTableName} (
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

    // Process file stream - Linus style: simple and efficient
    let recordCount = 0
    const batchSize = 5000 // Larger batch size, fewer inserts
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
        
        for (const line of lines) {
          if (!line.trim()) continue
          
          const values = parseCSVLine(line)
          
          if (isFirstRow) {
            headers = values
            isFirstRow = false
            continue
          }
          
          if (values.length !== headers.length) continue
          
          const record = createRecordFromCSV(headers, values)
          if (record) {
            batch.push(record)
            
            if (batch.length >= batchSize) {
              // Don't await - keep the stream flowing
              const batchToInsert = batch
              batch = []
              
              // Simple approach: process batches sequentially but keep memory low
              await insertBatch(tempTableName, batchToInsert)
              recordCount += batchToInsert.length
              
              // Update progress less frequently to reduce Redis calls
              if (recordCount - lastProgressUpdate > 10000) {
                lastProgressUpdate = recordCount
                await redis.set(`upload_progress:${sessionId}`, recordCount)
              }
            }
          }
        }
      }
      
      // Insert final batch
      if (batch.length > 0) {
        await insertBatch(tempTableName, batch)
        recordCount += batch.length
      }
      
      // All inserts are already completed
      
      // Update session status
      await prisma.uploadSession.update({
        where: { id: sessionId },
        data: {
          status: 'completed',
          recordCount,
          processedAt: new Date()
        }
      })
      
      // Cache session info
      await redis.setEx(`session:${sessionId}`, 3600 * 24, JSON.stringify({
        id: sessionId,
        filename: file.name,
        recordCount,
        tempTableName
      }))
      
      // Create response with session cookie
      const response = NextResponse.json({ 
        message: 'File uploaded successfully',
        sessionId,
        recordsProcessed: recordCount
      })
      
      response.cookies.set('adx_session_id', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      })
      
      return response
      
    } catch (error) {
      // Clean up on error
      try {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${tempTableName}`)
      } catch (e) {
        console.error('Failed to drop temp table:', e)
      }
      
      try {
        await prisma.uploadSession.update({
          where: { id: sessionId },
          data: { 
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          }
        })
      } catch (e) {
        console.error('Failed to update session status:', e)
      }
      
      // Clear batch to prevent memory leak
      batch = []
      throw error
    } finally {
      // Ensure batch is cleared
      batch = []
    }
    
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to process file' },
      { status: 500 }
    )
  }
}

async function insertBatch(tableName: string, batch: any[]) {
  // Linus: The right way - use COPY for bulk inserts
  const csvContent = batch.map(record => [
    record.dataDate ? record.dataDate.toISOString().split('T')[0] : '',
    record.website || '',
    record.country || '',
    record.adFormat || '',
    record.adUnit || '',
    record.advertiser || '',
    record.domain || '',
    record.device || '',
    record.browser || '',
    record.requests || '',
    record.impressions || '',
    record.clicks || '',
    record.ctr || '',
    record.ecpm || '',
    record.revenue || '',
    record.viewableImpressions || '',
    record.viewabilityRate || '',
    record.measurableImpressions || '',
    record.fillRate || '',
    record.arpu || ''
  ].map(v => v.replace(/"/g, '""')).map(v => v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v}"` : v).join(',')).join('\n')
  
  // Use stream to avoid loading everything in memory
  const stream = require('stream')
  const { Readable } = stream
  
  const csvStream = Readable.from([csvContent])
  
  return new Promise((resolve, reject) => {
    const copyQuery = `
      COPY ${tableName} (
        dataDate, website, country, adFormat, adUnit, advertiser, domain,
        device, browser, requests, impressions, clicks, ctr, ecpm, revenue,
        viewableImpressions, viewabilityRate, measurableImpressions, fillRate, arpu
      ) FROM STDIN WITH (FORMAT CSV, HEADER FALSE)
    `
    
    // This would be the ideal way, but Prisma doesn't support COPY directly
    // For now, we'll use a more efficient batch insert
    const chunks = []
    for (let i = 0; i < batch.length; i += 1000) {
      chunks.push(batch.slice(i, i + 1000))
    }
    
    Promise.all(chunks.map(chunk => insertChunk(tableName, chunk)))
      .then(resolve)
      .catch(reject)
  })
}

// Helper function for smaller chunks
async function insertChunk(tableName: string, chunk: any[]) {
  const placeholders = chunk.map((_, i) => `($${i * 20 + 1}, $${i * 20 + 2}, $${i * 20 + 3}, $${i * 20 + 4}, $${i * 20 + 5}, $${i * 20 + 6}, $${i * 20 + 7}, $${i * 20 + 8}, $${i * 20 + 9}, $${i * 20 + 10}, $${i * 20 + 11}, $${i * 20 + 12}, $${i * 20 + 13}, $${i * 20 + 14}, $${i * 20 + 15}, $${i * 20 + 16}, $${i * 20 + 17}, $${i * 20 + 18}, $${i * 20 + 19}, $${i * 20 + 20})`).join(',')
  
  const values = chunk.flatMap(record => [
    record.dataDate,
    record.website,
    record.country,
    record.adFormat,
    record.adUnit,
    record.advertiser,
    record.domain,
    record.device,
    record.browser,
    record.requests,
    record.impressions,
    record.clicks,
    record.ctr,
    record.ecpm,
    record.revenue,
    record.viewableImpressions,
    record.viewabilityRate,
    record.measurableImpressions,
    record.fillRate,
    record.arpu
  ])
  
  await prisma.$executeRawUnsafe(`
    INSERT INTO ${tableName} (
      dataDate, website, country, adFormat, adUnit, advertiser, domain,
      device, browser, requests, impressions, clicks, ctr, ecpm, revenue,
      viewableImpressions, viewabilityRate, measurableImpressions, fillRate, arpu
    ) VALUES ${placeholders}
  `, ...values)
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current.trim())
  return result
}

function createRecordFromCSV(headers: string[], values: string[]): any {
  const record: any = {}
  
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, '')
    const value = values[i]?.trim()
    
    if (!value) continue
    
    // Chinese column mappings
    switch (header) {
      case 'date':
      case 'data_date':
      case '日期':
        record.dataDate = new Date(value)
        break
      case 'website':
      case '网站':
        record.website = value
        break
      case 'country':
      case '国家地区':
      case '国家':
        record.country = value
        break
      case 'adformat':
      case 'ad_format':
      case '广告资源格式':
      case '广告格式':
        record.adFormat = value
        break
      case 'adunit':
      case 'ad_unit':
      case '广告单元所有级别':
      case '广告单元':
        record.adUnit = value
        break
      case 'advertiser':
      case '广告客户已分类':
      case '广告客户':
        record.advertiser = value
        break
      case 'domain':
      case '广告客户网域':
      case '域名':
        record.domain = value
        break
      case 'device':
      case '设备':
        record.device = value
        break
      case 'browser':
      case '浏览器':
        record.browser = value
        break
      case 'requests':
      case 'adexchange请求总数':
      case '请求总数':
        record.requests = value ? BigInt(value) : null
        break
      case 'impressions':
      case 'adexchange展示次数':
      case '展示次数':
        record.impressions = value ? BigInt(value) : null
        break
      case 'clicks':
      case 'adexchange点击次数':
      case '点击次数':
        record.clicks = value ? BigInt(value) : null
        break
      case 'ctr':
      case 'adexchange点击率':
      case '点击率':
        record.ctr = value ? parseFloat(value) : null
        break
      case 'ecpm':
      case 'adexchange平均ecpm':
      case '平均ecpm':
        record.ecpm = value ? parseFloat(value) : null
        break
      case 'revenue':
      case 'adexchange收入':
      case '收入':
        record.revenue = value ? parseFloat(value) : null
        break
      case 'viewableimpressions':
      case 'viewable_impressions':
      case 'adexchangeactiveview可见展示次数':
      case '可见展示次数':
        record.viewableImpressions = value ? BigInt(value) : null
        break
      case 'viewabilityrate':
      case 'viewability_rate':
      case 'adexchangeactiveview可见展示次数百分比':
      case '可见展示次数百分比':
        record.viewabilityRate = value ? parseFloat(value) : null
        break
      case 'measurableimpressions':
      case 'measurable_impressions':
      case 'adexchangeactiveview可衡量展示次数':
      case '可衡量展示次数':
        record.measurableImpressions = value ? BigInt(value) : null
        break
    }
  }
  
  if (!record.website || !record.dataDate) {
    return null
  }
  
  // Calculate derived metrics
  if (record.requests && record.impressions) {
    record.fillRate = (Number(record.impressions) / Number(record.requests)) * 100
  }
  
  if (record.revenue && record.requests) {
    record.arpu = (record.revenue / Number(record.requests)) * 1000
  }
  
  return record
}