const fs = require('fs');
const path = require('path');

// 模拟列映射逻辑
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

function createColumnMap(headers) {
  const columnMap = {};
  
  console.log('输入的表头:', headers);
  
  headers.forEach((header, index) => {
    const normalizedHeader = header.trim().toLowerCase();
    
    // 检查每个可能的列类型
    for (const [columnType, possibleNames] of Object.entries(COLUMN_MAPPINGS)) {
      for (const name of possibleNames) {
        if (normalizedHeader === name.toLowerCase()) {
          // 检查是否已经被映射
          if (columnMap[columnType] !== undefined) {
            console.log(`冲突: ${header} 想要映射到 ${columnType}，但该列已经被映射到索引 ${columnMap[columnType]}`);
          }
          columnMap[columnType] = index;
          console.log(`[DEBUG] Mapped column "${header}" to ${columnType} at index ${index}`);
          break;
        }
      }
    }
  });
  
  console.log('最终映射:', columnMap);
  return columnMap;
}

// 测试小文件的列名
const smallFileHeaders = [
  '日期',
  '网站', 
  '国家/地区',
  '广告资源格式',
  '广告单元（所有级别）',
  '广告客户（已分类）',
  '广告客户网域',
  '设备',
  '浏览器',
  'Ad Exchange 请求总数',
  'Ad Exchange 展示次数',
  'Ad Exchange 点击次数',
  'Ad Exchange 点击率',
  'Ad Exchange 平均 eCPM',
  'Ad Exchange 收入',
  'Ad Exchange Active View可见展示次数',
  'Ad Exchange Active View可见展示次数百分比',
  'Ad Exchange Active View可衡量展示次数'
];

console.log('=== 小文件列映射测试 ===');
const smallMap = createColumnMap(smallFileHeaders);

// 测试大文件的列名
const largeFileHeaders = [
  '网站',
  '国家/地区',
  '广告资源格式',
  '广告单元（所有级别）',
  '广告客户（已分类）',
  '广告客户网域',
  '设备',
  '浏览器',
  '日期',
  'Ad Exchange 请求总数',
  'Ad Exchange 展示次数',
  'Ad Exchange 点击次数',
  'Ad Exchange 点击率',
  'Ad Exchange 平均 eCPM',
  'Ad Exchange 收入',
  'Ad Exchange Active View可见展示次数',
  'Ad Exchange Active View可见展示次数百分比',
  'Ad Exchange Active View可衡量展示次数'
];

console.log('\n=== 大文件列映射测试 ===');
const largeMap = createColumnMap(largeFileHeaders);