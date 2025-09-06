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
    const header = headers[i].toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, '')
    const value = values[i]
    
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
      case '国家/地区':
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
      case '广告单元（所有级别）':
      case '广告单元':
        record.adUnit = value
        break
      case 'advertiser':
      case '广告客户（已分类）':
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
      case 'ad exchange active view可见展示次数':
      case '可见展示次数':
        record.viewableImpressions = value ? BigInt(value) : null
        break
      case 'viewabilityrate':
      case 'viewability_rate':
      case 'ad exchange active view可见展示次数百分比':
      case '可见展示次数百分比':
        record.viewabilityRate = value ? parseFloat(value) : null
        break
      case 'measurableimpressions':
      case 'measurable_impressions':
      case 'ad exchange active view可衡量展示次数':
      case '可衡量展示次数':
        record.measurableImpressions = value ? BigInt(value) : null
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