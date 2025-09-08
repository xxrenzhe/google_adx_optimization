const fs = require('fs');
const path = require('path');

// Import the CSV parsing and column mapping logic from upload-optimized route
const COLUMN_MAPPINGS = {
  date: ['日期', 'Date', '日期', '时间', 'Time'],
  website: ['网站', 'Website', '域名', 'Domain', '网址', 'Site'],
  country: ['国家', 'Country', '国家/地区', '国家地区', '地区', 'Region'],
  adFormat: ['广告格式', 'Ad Format', '广告类型', 'Ad Type', '广告资源格式', '广告形式', 'Format'],
  adUnit: ['广告单元', 'Ad Unit', '广告单元名称', '单元', 'Unit'],
  advertiser: ['广告客户', 'Advertiser', '广告主', '客户', 'Client'],
  domain: ['域名', 'Domain', '网域', '广告客户网域', '客户域名'],
  device: ['设备', 'Device', '设备类型', '设备型号', '平台', 'Platform'],
  browser: ['浏览器', 'Browser', '浏览器的类型', 'Browser Type'],
  requests: ['请求数', 'Requests', '请求数量', '请求数目', 'Ad Exchange 请求总数'],
  impressions: ['展示数', 'Impressions', '展示次数', '展示量', 'Ad Exchange 展示次数'],
  clicks: ['点击数', 'Clicks', '点击次数', '点击量', 'Ad Exchange 点击次数'],
  ctr: ['点击率', 'CTR', 'Click Through Rate', '点击率(%)'],
  ecpm: ['eCPM', 'CPM', '千次展示收入', '平均eCPM', 'Ad Exchange 平均 eCPM'],
  revenue: ['收入', 'Revenue', '收益', '收入金额', 'Ad Exchange 收入'],
  viewableImpressions: ['可见展示', 'Viewable Impressions', '可见展示次数', 'Active View可见展示次数'],
  viewabilityRate: ['可见率', 'Viewability Rate', '可见展示率', 'Active View可见展示次数百分比'],
  measurableImpressions: ['可衡量展示', 'Measurable Impressions', '可衡量展示次数', 'Active View可衡量展示次数']
};

// Parse CSV line with quoted field support
function parseCSVLine(line) {
  const cols = [];
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

// Create column name to index mapping
function createColumnMap(headers) {
  const columnMap = {};
  
  headers.forEach((header, index) => {
    const normalizedHeader = header.trim().toLowerCase();
    
    // Check each possible column type
    for (const [columnType, possibleNames] of Object.entries(COLUMN_MAPPINGS)) {
      for (const name of possibleNames) {
        if (normalizedHeader === name.toLowerCase() || 
            normalizedHeader.includes(name.toLowerCase()) ||
            name.toLowerCase().includes(normalizedHeader)) {
          columnMap[columnType] = index;
          console.log(`[DEBUG] Mapped column "${header}" to ${columnType} at index ${index}`);
          break;
        }
      }
    }
  });
  
  return columnMap;
}

// Test function
function testColumnRecognition(filePath, fileName) {
  console.log(`\n=== Testing ${fileName} ===`);
  
  // Read first line (headers)
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const headerLine = lines[0];
  
  console.log(`Header line: ${headerLine}`);
  
  // Parse headers
  const headers = parseCSVLine(headerLine);
  console.log(`Parsed headers:`, headers);
  
  // Create column map
  const columnMap = createColumnMap(headers);
  console.log('\nColumn mapping:');
  Object.entries(columnMap).forEach(([key, value]) => {
    console.log(`  ${key}: column ${value} ("${headers[value]}")`);
  });
  
  // Test parsing a data row
  if (lines.length > 1) {
    console.log('\n--- Testing data parsing ---');
    const dataLine = lines[1];
    console.log(`Data line: ${dataLine}`);
    
    const cols = parseCSVLine(dataLine);
    
    // Helper functions
    const getValue = (columnType, defaultValue = 'Unknown') => {
      const index = columnMap[columnType];
      return index !== undefined ? cols[index]?.trim() || defaultValue : defaultValue;
    };
    
    const getNumericValue = (columnType, defaultValue = 0) => {
      const index = columnMap[columnType];
      return index !== undefined ? parseFloat(cols[index]) || defaultValue : defaultValue;
    };
    
    // Extract and display key values
    console.log('\nExtracted values:');
    console.log(`  Date: ${getValue('date')}`);
    console.log(`  Website: ${getValue('website')}`);
    console.log(`  Country: ${getValue('country')}`);
    console.log(`  Ad Format: ${getValue('adFormat')}`);
    console.log(`  Device: ${getValue('device')}`);
    console.log(`  Requests: ${getNumericValue('requests')}`);
    console.log(`  Impressions: ${getNumericValue('impressions')}`);
    console.log(`  Revenue: ${getNumericValue('revenue')}`);
    console.log(`  eCPM: ${getNumericValue('ecpm')}`);
  }
  
  console.log('\n=== End of test ===\n');
}

// Test both files
try {
  testColumnRecognition('./Detail_report.csv', 'Detail_report.csv');
  testColumnRecognition('./files/Detail_report_35M.csv', 'Detail_report_35M.csv');
  
  console.log('\n✅ Column recognition test completed successfully!');
  console.log('\nSummary:');
  console.log('- Detail_report.csv: Uses English headers with standard order');
  console.log('- Detail_report_35M.csv: Uses Chinese headers with different order');
  console.log('- The dynamic column mapping system should handle both formats correctly');
} catch (error) {
  console.error('❌ Test failed:', error.message);
}