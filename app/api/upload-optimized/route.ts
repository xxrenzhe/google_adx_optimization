import { NextRequest, NextResponse } from 'next/server'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { createReadStream, createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { createInterface } from 'readline'
import { CONFIG as FILE_CONFIG, validateFile, createColumnMap, parseCSVLine, updateAggregator, getTopItems, detectAndCorrectDataIssues, updateFillRateDistribution, calculateDailyTrend, filterData, createSummary } from '@/lib/file-processing'
import { CONFIG } from '@/lib/config'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')
    
    if (!fileId) {
      return NextResponse.json({ error: 'Missing fileId' }, { status: 400 })
    }
    
    // 查询状态文件
    const statusPath = join(CONFIG.DIRECTORIES.RESULTS_DIR, `${fileId}.status`)
    
    try {
      const statusData = await readFile(statusPath, 'utf-8')
      const status = JSON.parse(statusData)
      
      return NextResponse.json(status)
    } catch (error) {
      // 如果状态文件不存在，返回not_found
      return NextResponse.json({ 
        status: 'not_found',
        error: 'File not found'
      }, { status: 404 })
    }
    
  } catch (error) {
    console.error('Status query error:', error)
    return NextResponse.json(
      { error: 'Failed to query status' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // 确保目录存在
    await mkdir(CONFIG.DIRECTORIES.UPLOAD_DIR, { recursive: true })
    await mkdir(CONFIG.DIRECTORIES.RESULTS_DIR, { recursive: true })

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: '没有找到文件' }, { status: 400 })
    }

    // 验证文件
    validateFile(file)

    const fileId = crypto.randomUUID()
    const fileName = `${fileId}${file.name.endsWith('.csv') ? '' : '.csv'}`
    const filePath = join(CONFIG.DIRECTORIES.UPLOAD_DIR, fileName)

    // 保存上传的文件
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, fileBuffer)

    // 创建状态文件
    const statusPath = join(CONFIG.DIRECTORIES.RESULTS_DIR, `${fileId}.status`)
    await writeFile(statusPath, JSON.stringify({
      status: 'processing',
      fileName: file.name,
      fileSize: file.size,
      uploadTime: new Date().toISOString(),
      progress: 0
    }))

    // 异步处理文件（不等待）
    setTimeout(() => {
      processFile(fileId, filePath, statusPath, file.size).catch(console.error)
    }, 100)

    return NextResponse.json({
      fileId,
      message: '文件上传成功，正在分析中...',
      fileName: file.name,
      fileSize: file.size
    })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '文件上传失败' },
      { status: 500 }
    )
  }
}

// 处理文件的函数
async function processFile(fileId: string, filePath: string, statusPath: string, fileSize: number) {
  try {
    const stream = createReadStream(filePath)
    const rl = createInterface({
      input: stream,
      crlfDelay: Infinity,
      terminal: false
    })

    // 聚合器 - 简化版数据结构
    const aggregator = {
      summary: {
        totalRows: 0,
        totalRevenue: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalRequests: 0,
        avgEcpm: 0,
        avgCtr: 0
      },
      websites: new Map<string, any>(),
      countries: new Map<string, any>(),
      dates: new Map<string, any>(),
      devices: new Map<string, any>(),
      adFormats: new Map<string, any>(),
      advertisers: new Map<string, any>(),
      domains: new Map<string, any>(),
      browsers: new Map<string, any>(),
      adUnits: new Map<string, any>(),
      detailedData: {
        countryDevice: new Map<string, any>(),
        countryAdFormat: new Map<string, any>(),
        deviceAdFormat: new Map<string, any>(),
        websiteCountry: new Map<string, any>(),
        adUnitAdFormat: new Map<string, any>()
      },
      samplePreview: [] as any[],
      fillRateDistribution: {
        "0-20%": 0,
        "20-40%": 0,
        "40-60%": 0,
        "60-80%": 0,
        "80-100%": 0
      }
    }

    let lineCount = 0
    let processedLines = 0
    let processedBytes = 0
    let lastProgress = 0
    let columnMap: Record<string, number> = {}

    for await (const line of rl) {
      if (lineCount === 0) {
        // 解析标题行
        const headers = parseCSVLine(line)
        console.log(`[DEBUG] Headers detected:`, headers)
        columnMap = createColumnMap(headers)
        
        // 检查必需列
        if (columnMap.date === undefined || columnMap.website === undefined) {
          throw new Error('CSV文件必须包含日期和网站列')
        }
        
        lineCount++
        continue
      }

      // 解析CSV行
      const cols = parseCSVLine(line)
      
      // 使用列映射获取数据
      const getValue = (columnType: string, defaultValue: string = 'Unknown') => {
        const index = columnMap[columnType]
        return index !== undefined ? cols[index]?.trim() || defaultValue : defaultValue
      }
      
      const getNumericValue = (columnType: string, defaultValue: number = 0) => {
        const index = columnMap[columnType]
        return index !== undefined ? parseFloat(cols[index]) || defaultValue : defaultValue
      }
      
      if (cols.length < Math.max(...Object.values(columnMap)) + 1) {
        lineCount++
        continue
      }

      try {
        const date = getValue('date')
        const website = getValue('website')
        let country = getValue('country')
        let adFormat = getValue('adFormat')
        
        // 智能数据检测和纠正
        const rawData = { date, website, country, adFormat }
        const corrected = detectAndCorrectDataIssues(rawData, processedLines)
        country = corrected.country || country
        adFormat = corrected.adFormat || adFormat
        
        const adUnit = getValue('adUnit')
        const advertiser = getValue('advertiser')
        const domain = getValue('domain')
        const device = getValue('device')
        const browser = getValue('browser')
        const requests = getNumericValue('requests')
        const impressions = getNumericValue('impressions')
        const clicks = getNumericValue('clicks')
        const ctr = getNumericValue('ctr')
        const ecpm = getNumericValue('ecpm')
        const revenue = getNumericValue('revenue')

        // 更新汇总数据
        aggregator.summary.totalRevenue += revenue
        aggregator.summary.totalImpressions += impressions
        aggregator.summary.totalClicks += clicks
        aggregator.summary.totalRequests += requests

        // 聚合数据
        updateAggregator(aggregator.websites, website, { revenue, impressions, clicks, requests })
        updateAggregator(aggregator.countries, country, { revenue, impressions, clicks, requests })
        if (date) {
          updateAggregator(aggregator.dates, date, { revenue, impressions, clicks, requests })
        }
        updateAggregator(aggregator.devices, device, { revenue, impressions, clicks, requests })
        updateAggregator(aggregator.adFormats, adFormat, { revenue, impressions, clicks, requests })
        updateAggregator(aggregator.advertisers, advertiser, { revenue, impressions, clicks, requests })
        updateAggregator(aggregator.domains, domain, { revenue, impressions, clicks, requests })
        updateAggregator(aggregator.browsers, browser, { revenue, impressions, clicks, requests })
        updateAggregator(aggregator.adUnits, adUnit, { revenue, impressions, clicks, requests })
        
        // 更新详细组合数据
        if (country && device) {
          updateAggregator(aggregator.detailedData.countryDevice, `${country}|${device}`, { revenue, impressions, clicks, requests })
        }
        if (country && adFormat) {
          updateAggregator(aggregator.detailedData.countryAdFormat, `${country}|${adFormat}`, { revenue, impressions, clicks, requests })
        }
        if (device && adFormat) {
          updateAggregator(aggregator.detailedData.deviceAdFormat, `${device}|${adFormat}`, { revenue, impressions, clicks, requests })
        }
        if (website && country) {
          updateAggregator(aggregator.detailedData.websiteCountry, `${website}|${country}`, { revenue, impressions, clicks, requests })
        }
        if (adUnit && adFormat) {
          updateAggregator(aggregator.detailedData.adUnitAdFormat, `${adUnit}|${adFormat}`, { revenue, impressions, clicks, requests })
        }

        // 计算填充率
        const fillRate = requests > 0 ? (impressions / requests * 100) : 0
        updateFillRateDistribution(aggregator.fillRateDistribution, fillRate)
        
        // 保存样本数据
        if (aggregator.samplePreview.length < FILE_CONFIG.SAMPLE_SIZE) {
          aggregator.samplePreview.push({
            date, website, country, adFormat, adUnit, advertiser, domain, device, browser,
            requests, impressions, clicks,
            ctr: ctr || (impressions > 0 ? (clicks / impressions * 100) : 0),
            ecpm: ecpm || (impressions > 0 ? (revenue / impressions * 1000) : 0),
            revenue,
            viewableImpressions: getNumericValue('viewableImpressions'),
            viewabilityRate: getNumericValue('viewabilityRate'),
            measurableImpressions: getNumericValue('measurableImpressions'),
            fillRate,
            arpu: requests > 0 ? revenue / requests : 0
          })
        }

        processedLines++

        // 更新进度
        let progress = 0
        if (processedLines === 1) {
          progress = 10
        } else if (processedLines < 100) {
          if (processedLines % 10 === 0) {
            progress = Math.min(50, 10 + Math.floor((processedLines / 100) * 40))
          }
        } else if (processedLines < 1000) {
          if (processedLines % 100 === 0) {
            progress = Math.min(80, 50 + Math.floor(((processedLines - 100) / 900) * 30))
          }
        } else {
          if (processedLines % 1000 === 0) {
            const estimatedTotalLines = Math.floor(processedLines * (fileSize / (processedBytes || 1)))
            progress = Math.min(95, 50 + Math.floor((processedLines / Math.max(estimatedTotalLines, processedLines)) * 45))
          }
        }
        
        if (progress > 0 && progress > lastProgress) {
          await updateStatus(statusPath, { progress, processedLines })
          lastProgress = progress
        }
        
      } catch (e) {
        console.warn('Error processing line:', lineCount, e)
      }
      
      processedBytes += line.length + 1
      lineCount++
    }

    // 计算最终结果
    aggregator.summary = createSummary(
      processedLines,
      aggregator.summary.totalRevenue,
      aggregator.summary.totalImpressions,
      aggregator.summary.totalClicks,
      aggregator.summary.totalRequests
    )

    // 处理聚合数据
    const result = {
      fileId,
      fileName: filePath.split('/').pop(),
      summary: aggregator.summary,
      topWebsites: filterData(getTopItems(aggregator.websites, 20), 'websites'),
      topCountries: filterData(getTopItems(aggregator.countries, 20), 'countries'),
      dailyTrend: calculateDailyTrend(aggregator.dates),
      devices: filterData(getTopItems(aggregator.devices, 10), 'devices'),
      adFormats: filterData(getTopItems(aggregator.adFormats, 10), 'adFormats'),
      advertisers: getTopItems(aggregator.advertisers, 20),
      domains: getTopItems(aggregator.domains, 20),
      browsers: getTopItems(aggregator.browsers, 10),
      adUnits: getTopItems(aggregator.adUnits, 20),
      detailedAnalytics: {
        countryDeviceCombination: getTopItems(aggregator.detailedData.countryDevice, 50),
        countryAdFormatCombination: getTopItems(aggregator.detailedData.countryAdFormat, 50),
        deviceAdFormatCombination: getTopItems(aggregator.detailedData.deviceAdFormat, 50),
        websiteCountryCombination: getTopItems(aggregator.detailedData.websiteCountry, 50),
        adUnitAdFormatCombination: getTopItems(aggregator.detailedData.adUnitAdFormat, 50)
      },
      samplePreview: aggregator.samplePreview,
      fillRateDistribution: aggregator.fillRateDistribution,
      processedAt: new Date().toISOString()
    }

    // 保存结果
    const resultPath = join(CONFIG.DIRECTORIES.RESULTS_DIR, `${fileId}.json`)
    await writeFile(resultPath, JSON.stringify(result, null, 2))

    // 确保文件完全写入磁盘
    await new Promise(resolve => setTimeout(resolve, 500))

    // 更新状态为完成
    await updateStatus(statusPath, {
      status: 'completed',
      progress: 100,
      processedLines,
      completedAt: new Date().toISOString(),
      resultPath
    })

    // 清理内存
    aggregator.websites.clear()
    aggregator.countries.clear()
    aggregator.dates.clear()
    aggregator.devices.clear()
    aggregator.adFormats.clear()
    aggregator.advertisers.clear()
    aggregator.domains.clear()
    aggregator.browsers.clear()
    aggregator.adUnits.clear()
    aggregator.detailedData.countryDevice.clear()
    aggregator.detailedData.countryAdFormat.clear()
    aggregator.detailedData.deviceAdFormat.clear()
    aggregator.detailedData.websiteCountry.clear()
    aggregator.detailedData.adUnitAdFormat.clear()

    console.log(`File ${fileId} processed successfully. ${processedLines} rows.`)

  } catch (error) {
    console.error('Processing error:', error)
    await updateStatus(statusPath, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      failedAt: new Date().toISOString()
    })
  }
}

async function updateStatus(statusPath: string, data: any) {
  try {
    const currentStatus = JSON.parse(await readFile(statusPath, 'utf-8'))
    await writeFile(statusPath, JSON.stringify({ ...currentStatus, ...data }, null, 2))
  } catch (error) {
    console.error('Error updating status:', error)
  }
}