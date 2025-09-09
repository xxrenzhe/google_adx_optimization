#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

const RESULTS_DIR = path.join(process.cwd(), 'results');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// 简单的CSV处理函数
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

function createColumnMap(headers) {
  const map = {};
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  
  // 列名映射
  const columnMappings = {
    'date': ['date', '日期', 'day'],
    'website': ['website', 'site', 'domain', '域名', '网站'],
    'country': ['country', '国家', '地区'],
    'adformat': ['adformat', 'ad format', '广告格式', 'format'],
    'device': ['device', '设备', '设备类型'],
    'advertiser': ['advertiser', '广告客户', 'advertiser name'],
    'adunit': ['adunit', 'ad unit', '广告位', '广告单元'],
    'browser': ['browser', '浏览器'],
    'domain': ['domain', '域名'],
    'revenue': ['revenue', '收入', 'revenue usd'],
    'impressions': ['impressions', '展示次数', 'impr'],
    'clicks': ['clicks', '点击次数', 'click'],
    'requests': ['requests', '请求次数', 'request'],
    'viewableimpressions': ['viewableimpressions', '可见展示', 'viewable impr'],
    'viewabilityrate': ['viewabilityrate', '可见率', 'viewability rate']
  };
  
  for (const [column, possibleNames] of Object.entries(columnMappings)) {
    for (const name of possibleNames) {
      const index = normalizedHeaders.findIndex(h => h.includes(name));
      if (index !== -1) {
        map[column] = index;
        break;
      }
    }
  }
  
  return map;
}

// 轻量级聚合器
class LightweightAggregator {
  constructor() {
    this.summary = {
      totalRevenue: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalRequests: 0,
      avgEcpm: 0,
      avgCtr: 0,
      totalRows: 0
    };
    
    this.topData = {
      websites: {},
      countries: {},
      dates: {},
      devices: {},
      adFormats: {},
      advertisers: {},
      adUnits: {}
    };
    
    this.detailedCombinations = {
      countryDevice: {},
      countryAdFormat: {},
      deviceAdFormat: {},
      websiteCountry: {},
      adUnitAdFormat: {}
    };
    
    this.fillRateDistribution = {
      "0-20%": 0,
      "20-40%": 0,
      "40-60%": 0,
      "60-80%": 0,
      "80-100%": 0
    };
    
    this.samplePreview = [];
    this.detailedData = [];
    this.processedLines = 0;
    this.columnMap = {};
  }
  
  setColumnMap(map) {
    this.columnMap = map;
  }
  
  updateMetric(data, key, values) {
    if (!data[key]) {
      data[key] = {
        revenue: 0,
        impressions: 0,
        clicks: 0,
        requests: 0
      };
    }
    
    data[key].revenue += values.revenue;
    data[key].impressions += values.impressions;
    data[key].clicks += values.clicks;
    data[key].requests += values.requests;
  }
  
  updateCombination(data, key, values) {
    if (!data[key]) {
      data[key] = {
        revenue: 0,
        impressions: 0,
        clicks: 0,
        requests: 0
      };
    }
    
    data[key].revenue += values.revenue;
    data[key].impressions += values.impressions;
    data[key].clicks += values.clicks;
    data[key].requests += values.requests;
  }
  
  processRow(cols) {
    try {
      const getValue = (columnType, defaultValue = 'Unknown') => {
        const index = this.columnMap[columnType];
        return index !== undefined ? cols[index]?.trim() || defaultValue : defaultValue;
      };
      
      const getNumericValue = (columnType, defaultValue = 0) => {
        const index = this.columnMap[columnType];
        if (index === undefined) return defaultValue;
        const value = parseFloat(cols[index]) || 0;
        return isNaN(value) ? defaultValue : value;
      };
      
      const date = getValue('date', '');
      const website = getValue('website');
      const country = getValue('country');
      const adFormat = getValue('adFormat');
      const device = getValue('device');
      const advertiser = getValue('advertiser');
      
      const revenue = getNumericValue('revenue');
      const impressions = getNumericValue('impressions');
      const clicks = getNumericValue('clicks');
      const requests = getNumericValue('requests');
      
      // 更新汇总
      this.summary.totalRevenue += revenue;
      this.summary.totalImpressions += impressions;
      this.summary.totalClicks += clicks;
      this.summary.totalRequests += requests;
      
      // 更新聚合数据
      this.updateMetric(this.topData.websites, website, { revenue, impressions, clicks, requests });
      this.updateMetric(this.topData.countries, country, { revenue, impressions, clicks, requests });
      if (date) {
        this.updateMetric(this.topData.dates, date, { revenue, impressions, clicks, requests });
      }
      this.updateMetric(this.topData.devices, device, { revenue, impressions, clicks, requests });
      this.updateMetric(this.topData.adFormats, adFormat, { revenue, impressions, clicks, requests });
      this.updateMetric(this.topData.advertisers, advertiser, { revenue, impressions, clicks, requests });
      
      // 获取adUnit
      const adUnit = getValue('adUnit');
      if (adUnit && adUnit !== 'Unknown') {
        this.updateMetric(this.topData.adUnits, adUnit, { revenue, impressions, clicks, requests });
      }
      
      // 更新详细组合数据
      this.updateCombination(this.detailedCombinations.countryDevice, `${country}|${device}`, { revenue, impressions, clicks, requests });
      this.updateCombination(this.detailedCombinations.countryAdFormat, `${country}|${adFormat}`, { revenue, impressions, clicks, requests });
      this.updateCombination(this.detailedCombinations.deviceAdFormat, `${device}|${adFormat}`, { revenue, impressions, clicks, requests });
      this.updateCombination(this.detailedCombinations.websiteCountry, `${website}|${country}`, { revenue, impressions, clicks, requests });
      
      // 如果adUnit存在，更新adUnitAdFormat组合
      if (adUnit && adUnit !== 'Unknown' && adFormat && adFormat !== 'Unknown') {
        this.updateCombination(this.detailedCombinations.adUnitAdFormat, `${adUnit}|${adFormat}`, { revenue, impressions, clicks, requests });
      }
      
      // 填充率计算
      const fillRate = requests > 0 ? (impressions / requests * 100) : 0;
      if (fillRate < 20) this.fillRateDistribution["0-20%"]++;
      else if (fillRate < 40) this.fillRateDistribution["20-40%"]++;
      else if (fillRate < 60) this.fillRateDistribution["40-60%"]++;
      else if (fillRate < 80) this.fillRateDistribution["60-80%"]++;
      else this.fillRateDistribution["80-100%"]++;
      
      // 收集全量详细数据用于分析
      const detailedRecord = {
        date, website, country, adFormat, device,
        revenue, impressions, clicks, requests,
        ecpm: impressions > 0 ? (revenue / impressions * 1000) : 0,
        ctr: impressions > 0 ? (clicks / impressions * 100) : 0,
        // 额外字段用于更深入的分析
        browser: getValue('browser'),
        domain: getValue('domain', website),
        advertiser: getValue('advertiser'),
        adUnit: getValue('adUnit'),
        viewableImpressions: getNumericValue('viewableImpressions', impressions),
        viewabilityRate: getNumericValue('viewabilityRate', 100)
      };
      
        
      this.detailedData.push(detailedRecord);
      
      // 有限样本预览 - 只保留前20条用于界面预览
      if (this.samplePreview.length < 20) {
        this.samplePreview.push({
          date, website, country, adFormat, device,
          revenue, impressions, clicks, requests,
          ecpm: impressions > 0 ? (revenue / impressions * 1000) : 0,
          ctr: impressions > 0 ? (clicks / impressions * 100) : 0
        });
      }
      
      this.processedLines++;
      
    } catch (e) {
      // 静默忽略错误行
    }
  }
  
  getResult(fileId, fileName) {
    // 计算平均值
    this.summary.avgEcpm = this.summary.totalImpressions > 0 
      ? (this.summary.totalRevenue / this.summary.totalImpressions * 1000)
      : 0;
    this.summary.avgCtr = this.summary.totalImpressions > 0
      ? (this.summary.totalClicks / this.summary.totalImpressions * 100)
      : 0;
    this.summary.totalRows = this.processedLines;
    
    // 转换并排序Top数据
    const convertTopData = (data, limit) => {
      return Object.entries(data)
        .map(([name, values]) => ({
          name,
          revenue: values.revenue,
          impressions: values.impressions,
          clicks: values.clicks,
          requests: values.requests,
          ecpm: values.impressions > 0 ? (values.revenue / values.impressions * 1000) : 0,
          ctr: values.impressions > 0 ? (values.clicks / values.impressions * 100) : 0
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);
    };
    
    // 转换组合数据
    const convertCombinationData = (data) => {
      return Object.entries(data)
        .map(([name, values]) => ({
          name,
          revenue: values.revenue,
          impressions: values.impressions,
          clicks: values.clicks,
          requests: values.requests,
          ecpm: values.impressions > 0 ? (values.revenue / values.impressions * 1000) : 0,
          ctr: values.impressions > 0 ? (values.clicks / values.impressions * 100) : 0
        }))
        .sort((a, b) => b.revenue - a.revenue);
    };
    
    return {
      fileId,
      fileName,
      summary: this.summary,
      topWebsites: convertTopData(this.topData.websites, 10),
      topCountries: convertTopData(this.topData.countries, 10),
      dailyTrend: convertTopData(this.topData.dates, 30),
      devices: convertTopData(this.topData.devices, 5),
      adFormats: convertTopData(this.topData.adFormats, 5),
      advertisers: convertTopData(this.topData.advertisers || {}, 10),
      adUnits: convertTopData(this.topData.adUnits || {}, 10),
      samplePreview: this.samplePreview,
      detailedData: this.detailedData, // 包含全量详细数据
      detailedAnalytics: {
        countryDeviceCombination: convertCombinationData(this.detailedCombinations.countryDevice),
        countryAdFormatCombination: convertCombinationData(this.detailedCombinations.countryAdFormat),
        deviceAdFormatCombination: convertCombinationData(this.detailedCombinations.deviceAdFormat),
        websiteCountryCombination: convertCombinationData(this.detailedCombinations.websiteCountry),
        adUnitAdFormatCombination: convertCombinationData(this.detailedCombinations.adUnitAdFormat)
      },
      fillRateDistribution: this.fillRateDistribution,
      processedAt: new Date().toISOString()
    };
  }
  
  cleanup() {
    Object.keys(this.topData).forEach(key => {
      this.topData[key] = {};
    });
    Object.keys(this.detailedCombinations).forEach(key => {
      this.detailedCombinations[key] = {};
    });
    this.samplePreview.length = 0;
    this.detailedData.length = 0;
  }
}

async function processFile(fileId, filePath) {
  const aggregator = new LightweightAggregator();
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      throw new Error('Empty file');
    }
    
    // 处理标题行
    const headers = parseCSVLine(lines[0]);
    const columnMap = createColumnMap(headers);
    
    if (columnMap.date === undefined || columnMap.website === undefined) {
      throw new Error('CSV文件必须包含日期和网站列');
    }
    
    aggregator.setColumnMap(columnMap);
    
    // 处理数据行
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      aggregator.processRow(cols);
      
      // 进度报告
      if (i % 10000 === 0) {
        console.log(`Processed ${i} of ${lines.length - 1} lines...`);
      }
    }
    
    const fileName = path.basename(filePath);
    const result = aggregator.getResult(fileId, fileName);
    
    // 在cleanup之前创建深拷贝
    const resultCopy = JSON.parse(JSON.stringify(result));
    
    return resultCopy;
    
  } catch (error) {
    console.error(`Error processing file ${fileId}:`, error);
    throw error;
  } finally {
    aggregator.cleanup();
  }
}

async function regenerateResults() {
  try {
    // 获取所有结果文件
    const resultFiles = await fs.readdir(RESULTS_DIR);
    const jsonFiles = resultFiles.filter(file => file.endsWith('.json'));
    
    console.log(`Found ${jsonFiles.length} result files to regenerate...\n`);
    
    // 处理所有文件
    const filesToProcess = jsonFiles;
    
    for (const jsonFile of filesToProcess) {
      const fileId = jsonFile.replace('.json', '');
      const uploadFile = path.join(UPLOADS_DIR, fileId);
      const resultFile = path.join(RESULTS_DIR, jsonFile);
      
      try {
        await fs.access(uploadFile);
        
        console.log(`\nRegenerating ${fileId}...`);
        
        // 重新处理文件
        const result = await processFile(fileId, uploadFile);
        
        // 保存结果
        await fs.writeFile(resultFile, JSON.stringify(result, null, 2));
        
        console.log(`✓ Completed ${fileId}`);
        console.log(`  - Processed ${result.summary.totalRows} rows, collected ${result.detailedData.length} detailed records`);
        
        // 短暂延迟，避免内存问题
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.log(`✗ Upload file not found for ${fileId}, skipping...`);
        } else {
          console.error(`✗ Error processing ${fileId}:`, error.message);
        }
      }
    }
    
    console.log('\nRegeneration completed!');
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// 运行脚本
regenerateResults();