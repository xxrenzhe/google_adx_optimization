import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createInterface } from 'readline';

const UPLOAD_DIR = './uploads';
const RESULTS_DIR = './results';
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

export async function POST(request: NextRequest) {
  try {
    // 确保目录存在
    await mkdir(UPLOAD_DIR, { recursive: true });
    await mkdir(RESULTS_DIR, { recursive: true });

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: '没有找到文件' }, { status: 400 });
    }

    // 检查文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '文件过大，请上传小于200MB的文件' },
        { status: 400 }
      );
    }

    // 检查文件类型
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: '只支持CSV格式文件' },
        { status: 400 }
      );
    }

    const fileId = crypto.randomUUID();
    const fileName = `${fileId}${file.name.endsWith('.csv') ? '' : '.csv'}`;
    const filePath = join(UPLOAD_DIR, fileName);

    // 保存上传的文件
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, fileBuffer);

    // 创建状态文件
    const statusPath = join(RESULTS_DIR, `${fileId}.status`);
    await writeFile(statusPath, JSON.stringify({
      status: 'processing',
      fileName: file.name,
      fileSize: file.size,
      uploadTime: new Date().toISOString(),
      progress: 0
    }));

    // 异步处理文件（不等待）
    setTimeout(() => {
      processFile(fileId, filePath, statusPath, file.size).catch(console.error);
    }, 100);

    return NextResponse.json({
      fileId,
      message: '文件上传成功，正在分析中...',
      fileName: file.name,
      fileSize: file.size
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: '文件上传失败' },
      { status: 500 }
    );
  }
}

// 列名映射配置 - 基于实际CSV文件中的列名
const COLUMN_MAPPINGS = {
  date: ['日期', 'Date'],
  website: ['网站', 'Website'],
  country: ['国家/地区', '国家', 'Country'],
  adFormat: ['广告资源格式', '广告格式', 'Ad Format'],
  adUnit: ['广告单元（所有级别）', '广告单元', 'Ad Unit'],
  advertiser: ['广告客户（已分类）', '广告客户', 'Advertiser'],
  domain: ['广告客户网域', '域名', 'Domain'],
  device: ['设备', 'Device'],
  browser: ['浏览器', 'Browser'],
  requests: ['Ad Exchange 请求总数', '请求数', 'Requests'],
  impressions: ['Ad Exchange 展示次数', '展示数', 'Impressions'],
  clicks: ['Ad Exchange 点击次数', '点击数', 'Clicks'],
  ctr: ['Ad Exchange 点击率', '点击率', 'CTR'],
  ecpm: ['Ad Exchange 平均 eCPM', 'eCPM', 'CPM'],
  revenue: ['Ad Exchange 收入', '收入', 'Revenue'],
  viewableImpressions: ['Ad Exchange Active View可见展示次数', '可见展示', 'Viewable Impressions'],
  viewabilityRate: ['Ad Exchange Active View可见展示次数百分比', '可见率', 'Viewability Rate'],
  measurableImpressions: ['Ad Exchange Active View可衡量展示次数', '可衡量展示', 'Measurable Impressions']
};

// 创建列名到索引的映射 - 使用精确匹配
function createColumnMap(headers: string[]): Record<string, number> {
  const columnMap: Record<string, number> = {};
  
  headers.forEach((header, index) => {
    const normalizedHeader = header.trim().toLowerCase();
    
    // 检查每个可能的列类型 - 只使用精确匹配
    for (const [columnType, possibleNames] of Object.entries(COLUMN_MAPPINGS)) {
      for (const name of possibleNames) {
        if (normalizedHeader === name.toLowerCase()) {
          // 检查是否已经被映射
          if (columnMap[columnType] !== undefined) {
            console.log(`[WARNING] Column "${header}" conflicts with already mapped ${columnType} at index ${columnMap[columnType]}`);
          }
          columnMap[columnType] = index;
          console.log(`[DEBUG] Mapped column "${header}" to ${columnType} at index ${index}`);
          break;
        }
      }
    }
  });
  
  // 记录未找到的列
  const requiredColumns = ['date', 'website'];
  const missingColumns = requiredColumns.filter(col => columnMap[col] === undefined);
  if (missingColumns.length > 0) {
    console.log(`[DEBUG] Missing required columns: ${missingColumns.join(', ')}`);
    console.log(`[DEBUG] Available headers: ${headers.join(', ')}`);
  }
  
  return columnMap;
}

// 解析CSV行，正确处理带引号的字段
function parseCSVLine(line: string): string[] {
  const cols: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cols.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cols.push(current.trim());
  
  return cols;
}

async function processFile(fileId: string, filePath: string, statusPath: string, fileSize: number) {
  try {
    const stream = createReadStream(filePath);
    const rl = createInterface({
      input: stream,
      crlfDelay: Infinity,
      terminal: false
    });

    // 聚合器
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
      websites: new Map<string, {
        revenue: number;
        impressions: number;
        clicks: number;
        requests: number;
      }>(),
      countries: new Map<string, {
        revenue: number;
        impressions: number;
        clicks: number;
        requests: number;
      }>(),
      dates: new Map<string, {
        revenue: number;
        impressions: number;
        clicks: number;
        requests: number;
      }>(),
      devices: new Map<string, {
        revenue: number;
        impressions: number;
        clicks: number;
        requests: number;
      }>(),
      adFormats: new Map<string, {
        revenue: number;
        impressions: number;
        clicks: number;
        requests: number;
      }>(),
      advertisers: new Map<string, {
        revenue: number;
        impressions: number;
        clicks: number;
        requests: number;
      }>(),
      domains: new Map<string, {
        revenue: number;
        impressions: number;
        clicks: number;
        requests: number;
      }>(),
      browsers: new Map<string, {
        revenue: number;
        impressions: number;
        clicks: number;
        requests: number;
      }>(),
      adUnits: new Map<string, {
        revenue: number;
        impressions: number;
        clicks: number;
        requests: number;
      }>(),
      // 详细数据聚合，用于深度分析
      detailedData: {
        countryDevice: new Map<string, {
          revenue: number;
          impressions: number;
          clicks: number;
          requests: number;
        }>(),
        countryAdFormat: new Map<string, {
          revenue: number;
          impressions: number;
          clicks: number;
          requests: number;
        }>(),
        deviceAdFormat: new Map<string, {
          revenue: number;
          impressions: number;
          clicks: number;
          requests: number;
        }>(),
        websiteCountry: new Map<string, {
          revenue: number;
          impressions: number;
          clicks: number;
          requests: number;
        }>(),
        adUnitAdFormat: new Map<string, {
          revenue: number;
          impressions: number;
          clicks: number;
          requests: number;
        }>()
      },
      samplePreview: [] as any[], // 用于预览的样本数据（100行）
      fillRateDistribution: { // 实时计算的填充率分布
        "0-20%": 0,
        "20-40%": 0,
        "40-60%": 0,
        "60-80%": 0,
        "80-100%": 0
      }
    };

    let lineCount = 0;
    let processedLines = 0;
    let processedBytes = 0;
    let columnMap: Record<string, number> = {};

    for await (const line of rl) {
      if (lineCount === 0) {
        // 解析标题行
        const headers = parseCSVLine(line);
        console.log(`[DEBUG] Headers detected:`, headers);
        columnMap = createColumnMap(headers);
        
        // 检查必需列
        if (columnMap.date === undefined || columnMap.website === undefined) {
          throw new Error('CSV文件必须包含日期和网站列');
        }
        
        // 记录列映射结果
        console.log(`[DEBUG] Column mapping created:`);
        Object.entries(columnMap).forEach(([key, value]) => {
          console.log(`  ${key}: column ${value} ("${headers[value]}")`);
        });
        
        lineCount++;
        continue; // 跳过标题行
      }

      // 解析CSV行
      const cols = parseCSVLine(line);
      
      // 使用列映射获取数据
      const getValue = (columnType: string, defaultValue: string = 'Unknown') => {
        const index = columnMap[columnType];
        return index !== undefined ? cols[index]?.trim() || defaultValue : defaultValue;
      };
      
      const getNumericValue = (columnType: string, defaultValue: number = 0) => {
        const index = columnMap[columnType];
        return index !== undefined ? parseFloat(cols[index]) || defaultValue : defaultValue;
      };
      
      if (cols.length < Math.max(...Object.values(columnMap)) + 1) {
        console.log(`[DEBUG] Skipping line ${lineCount}: not enough columns (${cols.length} < ${Math.max(...Object.values(columnMap)) + 1})`);
        lineCount++;
        continue;
      }

      try {
        const date = getValue('date');
        const website = getValue('website');
        let country = getValue('country');
        let adFormat = getValue('adFormat');
        
        // 智能数据检测和纠正
        // 检测常见的列混淆情况
        const detectedIssues = [];
        
        // 1. 如果国家列包含广告格式关键词
        if (country.includes('广告') || country.includes('Ad') || country.includes('ad') || 
            country.includes('插页') || country.includes('横幅') || country.includes('视频') ||
            country.includes('原生') || country.includes('激励') || country.includes('Banner') ||
            country.includes('Interstitial') || country.includes('Rewarded')) {
          detectedIssues.push(`Country contains ad format: ${country}`);
          if (adFormat === 'Unknown') {
            adFormat = country;
            country = 'Unknown';
          }
        }
        
        // 2. 如果网站列看起来像国家
        const countryCodes = ['US', 'CN', 'JP', 'KR', 'UK', 'DE', 'FR', 'IT', 'ES', 'BR', 'IN', 'RU', 'CA', 'AU'];
        if (countryCodes.includes(website.toUpperCase()) || website.length === 2) {
          detectedIssues.push(`Website looks like country: ${website}`);
        }
        
        // 3. 如果adFormat看起来像国家
        const knownCountries = ['中国', '美国', '日本', '韩国', '英国', '德国', '法国', '意大利', '西班牙', '巴西', '印度', '俄罗斯', '加拿大', '澳大利亚'];
        if (knownCountries.includes(adFormat)) {
          detectedIssues.push(`AdFormat looks like country: ${adFormat}`);
          if (country === 'Unknown') {
            country = adFormat;
            adFormat = 'Unknown';
          }
        }
        
        // 记录检测到的问题
        if (detectedIssues.length > 0 && processedLines < 10) {
          console.log(`[DEBUG] Data issues detected at line ${processedLines}:`, detectedIssues);
          console.log(`[DEBUG] After correction - country: ${country}, adFormat: ${adFormat}`);
        }
        
        const adUnit = getValue('adUnit');
        const advertiser = getValue('advertiser');
        const domain = getValue('domain');
        const device = getValue('device');
        const browser = getValue('browser');
        const requests = getNumericValue('requests');
        const impressions = getNumericValue('impressions');
        const clicks = getNumericValue('clicks');
        const ctr = getNumericValue('ctr');
        const ecpm = getNumericValue('ecpm');
        const revenue = getNumericValue('revenue');

        // 更新汇总数据
        aggregator.summary.totalRevenue += revenue;
        aggregator.summary.totalImpressions += impressions;
        aggregator.summary.totalClicks += clicks;
        aggregator.summary.totalRequests += requests;

        // 聚合数据
        updateAggregator(aggregator.websites, website, { revenue, impressions, clicks, requests });
        updateAggregator(aggregator.countries, country, { revenue, impressions, clicks, requests });
        if (date) {
          updateAggregator(aggregator.dates, date, { revenue, impressions, clicks, requests });
          // Debug log
          if (processedLines < 5) {
            console.log(`[DEBUG] Adding date: ${date}, revenue: ${revenue}, impressions: ${impressions}, clicks: ${clicks}, requests: ${requests}`);
            console.log(`[DEBUG] Dates map size: ${aggregator.dates.size}`);
          }
        }
        updateAggregator(aggregator.devices, device, { revenue, impressions, clicks, requests });
        updateAggregator(aggregator.adFormats, adFormat, { revenue, impressions, clicks, requests });
        updateAggregator(aggregator.advertisers, advertiser, { revenue, impressions, clicks, requests });
        updateAggregator(aggregator.domains, domain, { revenue, impressions, clicks, requests });
        updateAggregator(aggregator.browsers, browser, { revenue, impressions, clicks, requests });
        updateAggregator(aggregator.adUnits, adUnit, { revenue, impressions, clicks, requests });
        
        // 更新详细组合数据
        if (country && device) {
          updateAggregator(aggregator.detailedData.countryDevice, `${country}|${device}`, { revenue, impressions, clicks, requests });
        }
        if (country && adFormat) {
          updateAggregator(aggregator.detailedData.countryAdFormat, `${country}|${adFormat}`, { revenue, impressions, clicks, requests });
        }
        if (device && adFormat) {
          updateAggregator(aggregator.detailedData.deviceAdFormat, `${device}|${adFormat}`, { revenue, impressions, clicks, requests });
        }
        if (website && country) {
          updateAggregator(aggregator.detailedData.websiteCountry, `${website}|${country}`, { revenue, impressions, clicks, requests });
        }
        if (adUnit && adFormat) {
          updateAggregator(aggregator.detailedData.adUnitAdFormat, `${adUnit}|${adFormat}`, { revenue, impressions, clicks, requests });
        }

        // 计算填充率和ARPU
        const fillRate = requests > 0 ? (impressions / requests * 100) : 0;
        const arpu = requests > 0 ? revenue / requests : 0;
        
        // 实时更新填充率分布
        if (fillRate < 20) {
          aggregator.fillRateDistribution["0-20%"]++;
        } else if (fillRate < 40) {
          aggregator.fillRateDistribution["20-40%"]++;
        } else if (fillRate < 60) {
          aggregator.fillRateDistribution["40-60%"]++;
        } else if (fillRate < 80) {
          aggregator.fillRateDistribution["60-80%"]++;
        } else {
          aggregator.fillRateDistribution["80-100%"]++;
        }
        
        // 简单采样：保存前100行用于预览
        const shouldSaveSample = aggregator.samplePreview.length < 100;
        
        if (shouldSaveSample) {
          aggregator.samplePreview.push({
            date, // 日期
            website, // 网站
            country, // 国家/地区
            adFormat, // 广告资源格式
            adUnit, // 广告单元（所有级别）
            advertiser, // 广告客户（已分类）
            domain, // 广告客户网域
            device, // 设备
            browser, // 浏览器
            requests, // Ad Exchange 请求总数
            impressions, // Ad Exchange 展示次数
            clicks, // Ad Exchange 点击次数
            ctr: ctr || (impressions > 0 ? (clicks / impressions * 100) : 0), // Ad Exchange 点击率
            ecpm: ecpm || (impressions > 0 ? (revenue / impressions * 1000) : 0), // Ad Exchange 平均 eCPM
            revenue, // Ad Exchange 收入
            viewableImpressions: getNumericValue('viewableImpressions'), // Ad Exchange Active View可见展示次数
            viewabilityRate: getNumericValue('viewabilityRate'), // Ad Exchange Active View可见展示次数百分比
            measurableImpressions: getNumericValue('measurableImpressions'), // Ad Exchange Active View可衡量展示次数
            fillRate, // 填充率
            arpu // ARPU
          });
        }

        processedLines++;

        // 更新进度 - 对于小文件更频繁地更新
        let progress = 0;
        if (processedLines === 1) {
          // 第一行处理完成后，设置初始进度
          progress = 10;
        } else if (processedLines < 100) {
          // 对于前100行，每处理10行更新一次
          if (processedLines % 10 === 0) {
            progress = Math.min(50, 10 + Math.floor((processedLines / 100) * 40));
          }
        } else if (processedLines < 1000) {
          // 对于100-1000行，每处理100行更新一次
          if (processedLines % 100 === 0) {
            progress = Math.min(80, 50 + Math.floor(((processedLines - 100) / 900) * 30));
          }
        } else {
          // 对于大文件，每处理1000行更新一次
          if (processedLines % 1000 === 0) {
            // 估算总行数，基于已处理的字节数
            const estimatedTotalLines = Math.floor(processedLines * (fileSize / (processedBytes || 1)));
            progress = Math.min(95, 50 + Math.floor((processedLines / Math.max(estimatedTotalLines, processedLines)) * 45));
          }
        }
        
        if (progress > 0) {
          console.log(`[DEBUG] Updating progress: ${progress}%, processedLines: ${processedLines}`);
          await updateStatus(statusPath, { progress, processedLines });
        }
        
        // 每10万行强制GC
        if (processedLines % 100000 === 0 && global.gc) {
          global.gc();
        }
      } catch (e) {
        console.warn('Error processing line:', lineCount, e);
      }
      
      // 更新已处理的字节数（估算）
      processedBytes += line.length + 1; // +1 for newline

      lineCount++;
    }

    // 计算最终结果
    aggregator.summary.totalRows = processedLines;
    aggregator.summary.avgEcpm = aggregator.summary.totalImpressions > 0 
      ? (aggregator.summary.totalRevenue / aggregator.summary.totalImpressions) * 1000 
      : 0;
    aggregator.summary.avgCtr = aggregator.summary.totalImpressions > 0
      ? (aggregator.summary.totalClicks / aggregator.summary.totalImpressions * 100)
      : 0;

    // 处理聚合数据
    console.log(`[DEBUG] Final dates map size: ${aggregator.dates.size}`);
    console.log(`[DEBUG] Sample dates entries:`);
    let count = 0;
    aggregator.dates.forEach((value, key) => {
      if (count < 3) {
        console.log(`  ${key}: revenue=${value.revenue}, impressions=${value.impressions}`);
        count++;
      }
    });
    
    const result = {
      fileId,
      fileName: filePath.split('/').pop(),
      summary: aggregator.summary,
      topWebsites: getTopItems(aggregator.websites, 20).filter(item => {
        // 过滤掉明显的非网站数据
        const isNotWebsite = item.name.length === 2 || 
                            ['中国', '美国', '日本', '广告', 'Ad'].includes(item.name) ||
                            item.name.includes('广告') || item.name.includes('插页');
        if (isNotWebsite && item.revenue > 0) {
          console.log(`[DEBUG] Filtered out non-website from websites: ${item.name} (revenue: ${item.revenue})`);
        }
        return !isNotWebsite;
      }),
      topCountries: getTopItems(aggregator.countries, 20).filter(item => {
        // 过滤掉明显的广告格式
        const isAdFormat = item.name.includes('广告') || item.name.includes('Ad') || item.name.includes('ad') ||
                          item.name.includes('插页') || item.name.includes('横幅') || item.name.includes('视频') ||
                          item.name.includes('Banner') || item.name.includes('Interstitial');
        if (isAdFormat && item.revenue > 0) {
          console.log(`[DEBUG] Filtered out ad format from countries: ${item.name} (revenue: ${item.revenue})`);
        }
        return !isAdFormat;
      }),
      dailyTrend: Array.from(aggregator.dates.entries())
        .map(([date, data]: [string, any]) => ({
          date,
          ...data,
          avgEcpm: data.impressions > 0 ? (data.revenue / data.impressions * 1000) : 0,
          ctr: data.impressions > 0 ? (data.clicks / data.impressions * 100) : 0
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      devices: getTopItems(aggregator.devices, 10).filter(item => {
        // 过滤掉明显的国家或网站
        const isNotDevice = item.name.length === 2 || 
                           ['中国', '美国', '日本', '网站'].includes(item.name);
        if (isNotDevice && item.revenue > 0) {
          console.log(`[DEBUG] Filtered out non-device from devices: ${item.name} (revenue: ${item.revenue})`);
        }
        return !isNotDevice;
      }),
      adFormats: getTopItems(aggregator.adFormats, 10).filter(item => {
        // 过滤掉明显的国家
        const isNotAdFormat = ['中国', '美国', '日本', 'Unknown'].includes(item.name);
        if (isNotAdFormat && item.revenue > 0) {
          console.log(`[DEBUG] Filtered out non-ad-format from adFormats: ${item.name} (revenue: ${item.revenue})`);
        }
        return !isNotAdFormat;
      }),
      advertisers: getTopItems(aggregator.advertisers, 20),
      domains: getTopItems(aggregator.domains, 20),
      browsers: getTopItems(aggregator.browsers, 10),
      adUnits: getTopItems(aggregator.adUnits, 20),
      // 详细组合数据
      detailedAnalytics: {
        countryDeviceCombination: getTopItems(aggregator.detailedData.countryDevice, 50),
        countryAdFormatCombination: getTopItems(aggregator.detailedData.countryAdFormat, 50),
        deviceAdFormatCombination: getTopItems(aggregator.detailedData.deviceAdFormat, 50),
        websiteCountryCombination: getTopItems(aggregator.detailedData.websiteCountry, 50),
        adUnitAdFormatCombination: getTopItems(aggregator.detailedData.adUnitAdFormat, 50)
      },
      samplePreview: aggregator.samplePreview, // 用于预览的样本数据（100行）
      fillRateDistribution: aggregator.fillRateDistribution, // 实时计算的填充率分布
      processedAt: new Date().toISOString()
    };

    // 保存结果
    const resultPath = join(RESULTS_DIR, `${fileId}.json`);
    console.log(`[DEBUG] Saving result with ${aggregator.samplePreview.length} sample data rows`);
    await writeFile(resultPath, JSON.stringify(result, null, 2));

    // 确保文件完全写入磁盘
    await new Promise(resolve => setTimeout(resolve, 500));

    // 验证文件确实存在且可读
    let verificationSuccess = false;
    let verifyAttempts = 0;
    while (!verificationSuccess && verifyAttempts < 5) {
      try {
        const verifyData = await readFile(resultPath, 'utf-8');
        JSON.parse(verifyData); // 确保JSON有效
        verificationSuccess = true;
        console.log(`[DEBUG] File verification successful on attempt ${verifyAttempts + 1}`);
      } catch (verifyError) {
        verifyAttempts++;
        if (verifyAttempts < 5) {
          console.log(`[DEBUG] File verification failed, attempt ${verifyAttempts + 1}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 200));
        } else {
          console.error(`[DEBUG] File verification failed after 5 attempts`);
          throw new Error('Failed to verify result file');
        }
      }
    }

    // 在完成前稍作延迟，让用户看到进度
    if (processedLines < 10) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 更新状态为完成 - 必须在文件验证成功后
    await updateStatus(statusPath, {
      status: 'completed',
      progress: 100,
      processedLines,
      completedAt: new Date().toISOString(),
      resultPath
    });

    // 清理大Map
    aggregator.websites.clear();
    aggregator.countries.clear();
    aggregator.dates.clear();
    aggregator.devices.clear();
    aggregator.adFormats.clear();
    aggregator.advertisers.clear();
    aggregator.domains.clear();
    aggregator.browsers.clear();
    aggregator.adUnits.clear();
    aggregator.detailedData.countryDevice.clear();
    aggregator.detailedData.countryAdFormat.clear();
    aggregator.detailedData.deviceAdFormat.clear();
    aggregator.detailedData.websiteCountry.clear();
    aggregator.detailedData.adUnitAdFormat.clear();

    console.log(`File ${fileId} processed successfully. ${processedLines} rows.`);

  } catch (error) {
    console.error('Processing error:', error);
    await updateStatus(statusPath, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      failedAt: new Date().toISOString()
    });
  }
}

function updateAggregator(
  map: Map<string, any>,
  key: string,
  data: { revenue: number; impressions: number; clicks: number; requests: number }
) {
  const current = map.get(key) || { revenue: 0, impressions: 0, clicks: 0, requests: 0 };
  current.revenue += data.revenue;
  current.impressions += data.impressions;
  current.clicks += data.clicks;
  current.requests += data.requests;
  map.set(key, current);
}

function getTopItems(map: Map<string, any>, limit: number) {
  return Array.from(map.entries())
    .map(([name, data]: [string, any]) => ({
      name,
      ...data,
      avgEcpm: data.impressions > 0 ? (data.revenue / data.impressions * 1000) : 0,
      ctr: data.impressions > 0 ? (data.clicks / data.impressions * 100) : 0
    }))
    .filter(item => item.revenue > 0)  // 只包含有收入的项目
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

async function updateStatus(statusPath: string, data: any) {
  try {
    const currentStatus = JSON.parse(await readFile(statusPath, 'utf-8'));
    await writeFile(statusPath, JSON.stringify({ ...currentStatus, ...data }, null, 2));
  } catch (error) {
    console.error('Error updating status:', error);
  }
}