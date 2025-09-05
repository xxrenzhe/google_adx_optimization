import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Readable } from 'stream'

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

    const stream = file.stream()
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    
    let headers: string[] = []
    let isFirstRow = true
    const batchSize = 1000
    let batch: any[] = []
    
    while (true) {
      const { done, value } = await reader.read()
      
      if (done) {
        if (batch.length > 0) {
          await prisma.adReport.createMany({
            data: batch,
            skipDuplicates: true
          })
        }
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
            await prisma.adReport.createMany({
              data: batch,
              skipDuplicates: true
            })
            batch = []
          }
        }
      }
    }
    
    return NextResponse.json({ 
      message: 'File uploaded successfully',
      recordsProcessed: await prisma.adReport.count()
    })
    
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to process file' },
      { status: 500 }
    )
  }
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
    const header = headers[i].toLowerCase().replace(/\s+/g, '')
    const value = values[i]
    
    switch (header) {
      case 'date':
      case 'data_date':
        record.dataDate = new Date(value)
        break
      case 'website':
        record.website = value
        break
      case 'country':
        record.country = value
        break
      case 'adformat':
      case 'ad_format':
        record.adFormat = value
        break
      case 'adunit':
      case 'ad_unit':
        record.adUnit = value
        break
      case 'advertiser':
        record.advertiser = value
        break
      case 'domain':
        record.domain = value
        break
      case 'device':
        record.device = value
        break
      case 'browser':
        record.browser = value
        break
      case 'requests':
        record.requests = value ? BigInt(value) : null
        break
      case 'impressions':
        record.impressions = value ? BigInt(value) : null
        break
      case 'clicks':
        record.clicks = value ? BigInt(value) : null
        break
      case 'ctr':
        record.ctr = value ? parseFloat(value) : null
        break
      case 'ecpm':
        record.ecpm = value ? parseFloat(value) : null
        break
      case 'revenue':
        record.revenue = value ? parseFloat(value) : null
        break
      case 'viewableimpressions':
      case 'viewable_impressions':
        record.viewableImpressions = value ? BigInt(value) : null
        break
      case 'viewabilityrate':
      case 'viewability_rate':
        record.viewabilityRate = value ? parseFloat(value) : null
        break
      case 'measurableimpressions':
      case 'measurable_impressions':
        record.measurableImpressions = value ? BigInt(value) : null
        break
      case 'fillrate':
      case 'fill_rate':
        record.fillRate = value ? parseFloat(value) : null
        break
      case 'arpu':
        record.arpu = value ? parseFloat(value) : null
        break
    }
  }
  
  if (!record.website || !record.dataDate) {
    return null
  }
  
  if (record.requests && record.impressions) {
    record.fillRate = (Number(record.impressions) / Number(record.requests)) * 100
  }
  
  if (record.revenue) {
    record.arpu = record.revenue / 5000
  }
  
  return record
}