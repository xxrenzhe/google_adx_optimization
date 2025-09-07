import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Readable } from 'stream'
import { createClient } from 'redis'
import { generateSessionId } from '@/lib/session'
import { pipeline } from 'stream/promises'
import { Writable } from 'stream'

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
    const tempTableName = `temp_ad_data_${sessionId.replace(/[^a-zA-Z0-9_]/g, '_')}`
    
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

    // Create temporary table with optimized indexes
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
      
      -- Create indexes after data load for faster bulk insert
    `)

    // Process file with optimized streaming
    const processingResult = await processFileStream(file.stream(), tempTableName, sessionId)
    
    // Create indexes after data is loaded
    await prisma.$executeRawUnsafe(`
      CREATE INDEX idx_${tempTableName}_date_website ON ${tempTableName} (dataDate, website);
      CREATE INDEX idx_${tempTableName}_country ON ${tempTableName} (country);
      CREATE INDEX idx_${tempTableName}_device ON ${tempTableName} (device);
    `)
    
    // Update session status
    await prisma.uploadSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        recordCount: processingResult.recordCount,
        processedAt: new Date()
      }
    })
    
    // Cache session info
    await redis.setEx(`session:${sessionId}`, 3600 * 24, JSON.stringify({
      id: sessionId,
      filename: file.name,
      recordCount: processingResult.recordCount,
      tempTableName
    }))
    
    const response = NextResponse.json({ 
      message: 'File uploaded successfully',
      sessionId,
      recordsProcessed: processingResult.recordCount,
      processingTime: processingResult.processingTime
    })
    
    response.cookies.set('adx_session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    })
    
    return response
    
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to process file' },
      { status: 500 }
    )
  }
}

async function processFileStream(stream: ReadableStream, tempTableName: string, sessionId: string) {
  const startTime = Date.now()
  let recordCount = 0
  let lastProgressUpdate = 0
  
  // Use PostgreSQL COPY for maximum efficiency
  const copyStream = new Writable({
    objectMode: true,
    highWaterMark: 100000 // Larger buffer for better performance
  })
  
  const batchBuffer: string[] = []
  const batchSize = 100000 // Increased batch size
  
  copyStream._write = async (record, encoding, callback) => {
    try {
      batchBuffer.push(formatRecordForCopy(record))
      
      if (batchBuffer.length >= batchSize) {
        await flushBatchToDatabase(batchBuffer.splice(0, batchSize))
        recordCount += batchSize
        
        // Update progress less frequently
        if (recordCount - lastProgressUpdate > 50000) {
          lastProgressUpdate = recordCount
          await redis.set(`upload_progress:${sessionId}`, recordCount)
        }
      }
      
      callback()
    } catch (error) {
      callback(error)
    }
  }
  
  copyStream._final = async (callback) => {
    try {
      // Flush remaining records
      if (batchBuffer.length > 0) {
        await flushBatchToDatabase(batchBuffer)
        recordCount += batchBuffer.length
      }
      
      callback()
    } catch (error) {
      callback(error)
    }
  }
  
  // Process the stream
  await pipeline(
    Readable.fromWeb(stream),
    createCSVParser(),
    copyStream
  )
  
  return {
    recordCount,
    processingTime: Date.now() - startTime
  }
}

async function flushBatchToDatabase(records: string[]) {
  const csvContent = records.join('\n')
  
  // Use a temporary file for COPY
  const tempFilePath = `/tmp/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.csv`
  
  try {
    require('fs').writeFileSync(tempFilePath, csvContent, 'utf8')
    
    await prisma.$executeRawUnsafe(`
      COPY ad_reports_temp (
        dataDate, website, country, adFormat, adUnit, advertiser, domain,
        device, browser, requests, impressions, clicks, ctr, ecpm, revenue,
        viewableImpressions, viewabilityRate, measurableImpressions, fillRate, arpu
      ) FROM '${tempFilePath}' WITH (FORMAT CSV, HEADER FALSE)
    `)
    
    // Clean up temp file
    require('fs').unlinkSync(tempFilePath)
  } catch (error) {
    // Clean up on error
    try {
      require('fs').unlinkSync(tempFilePath)
    } catch (e) {}
    throw error
  }
}

function formatRecordForCopy(record: any): string {
  return [
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
  ].map(v => v === null ? '' : String(v))
    .map(v => v.replace(/"/g, '""'))
    .map(v => v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v}"` : v)
    .join(',')
}

function createCSVParser() {
  let headers: string[] = []
  let isFirstRow = true
  
  return new TransformStream({
    transform(chunk, controller) {
      const lines = chunk.toString().split('\n')
      
      for (const line of lines) {
        if (!line.trim()) continue
        
        const values = parseCSVLine(line)
        
        if (isFirstRow) {
          headers = values
          isFirstRow = false
          continue
        }
        
        if (values.length === headers.length) {
          const record = createRecordFromCSV(headers, values)
          if (record) {
            controller.enqueue(record)
          }
        }
      }
    }
  })
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
    
    // Column mappings (same as before)
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
      // ... other mappings remain the same
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