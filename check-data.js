#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 读取最新的结果文件
const resultsDir = path.join(__dirname, 'results');
const files = fs.readdirSync(resultsDir).filter(f => f.endsWith('.json'));
const latestFile = files.sort()[files.length - 1];
const filePath = path.join(resultsDir, latestFile);

console.log(`\n检查文件: ${latestFile}\n`);

const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// 检查各个数据字段
const checks = [
  // 基础数据
  { field: 'summary', check: (d) => d.summary && Object.keys(d.summary).length > 0 },
  { field: 'topWebsites', check: (d) => d.topWebsites && d.topWebsites.length > 0 },
  { field: 'topCountries', check: (d) => d.topCountries && d.topCountries.length > 0 },
  { field: 'devices', check: (d) => d.devices && d.devices.length > 0 },
  { field: 'adFormats', check: (d) => d.adFormats && d.adFormats.length > 0 },
  { field: 'advertisers', check: (d) => d.advertisers && d.advertisers.length > 0 },
  { field: 'adUnits', check: (d) => d.adUnits && d.adUnits.length > 0 },
  { field: 'browsers', check: (d) => d.browsers && d.browsers.length > 0 },
  { field: 'domains', check: (d) => d.domains && d.domains.length > 0 },
  { field: 'dailyTrend', check: (d) => d.dailyTrend && d.dailyTrend.length > 0 },
  { field: 'samplePreview', check: (d) => d.samplePreview && d.samplePreview.length > 0 },
  { field: 'fillRateDistribution', check: (d) => d.fillRateDistribution && Object.keys(d.fillRateDistribution).length > 0 },
  
  // 详细分析数据
  { field: 'detailedAnalytics', check: (d) => d.detailedAnalytics && typeof d.detailedAnalytics === 'object' },
  { field: 'detailedAnalytics.countryDeviceCombination', check: (d) => d.detailedAnalytics?.countryDeviceCombination && d.detailedAnalytics.countryDeviceCombination.length > 0 },
  { field: 'detailedAnalytics.countryAdFormatCombination', check: (d) => d.detailedAnalytics?.countryAdFormatCombination && d.detailedAnalytics.countryAdFormatCombination.length > 0 },
  { field: 'detailedAnalytics.deviceAdFormatCombination', check: (d) => d.detailedAnalytics?.deviceAdFormatCombination && d.detailedAnalytics.deviceAdFormatCombination.length > 0 },
  { field: 'detailedAnalytics.websiteCountryCombination', check: (d) => d.detailedAnalytics?.websiteCountryCombination && d.detailedAnalytics.websiteCountryCombination.length > 0 },
  { field: 'detailedAnalytics.adUnitAdFormatCombination', check: (d) => d.detailedAnalytics?.adUnitAdFormatCombination && d.detailedAnalytics.adUnitAdFormatCombination.length > 0 },
  
  // 详细数据（用于高级分析）
  { field: 'detailedData', check: (d) => d.detailedData && d.detailedData.length > 0 }
];

console.log('数据完整性检查结果:\n');
console.log('字段'.padEnd(45), '状态'.padEnd(10), '详情');
console.log('-'.repeat(80));

let missingCount = 0;
let presentCount = 0;

checks.forEach(({ field, check }) => {
  const exists = check(data);
  const status = exists ? '✓ 存在' : '✗ 缺失';
  let details = '';
if (exists) {
  const value = field.split('.').reduce((o, i) => o?.[i], data);
  details = Array.isArray(value) ? `数量: ${value.length}` : '存在';
} else {
  details = '数据为空或不存在';
}
  
  console.log(field.padEnd(45), status.padEnd(10), details);
  
  if (exists) {
    presentCount++;
  } else {
    missingCount++;
  }
});

console.log('-'.repeat(80));
console.log(`\n总结: ${presentCount} 个字段存在, ${missingCount} 个字段缺失\n`);

// 检查数据质量问题
console.log('数据质量检查:\n');

// 检查 samplePreview 长度
if (data.samplePreview) {
  console.log(`samplePreview 长度: ${data.samplePreview.length} (预期: 20)`);
  if (data.samplePreview.length < 20) {
    console.log('  ⚠️  samplePreview 数量不足，可能影响界面预览');
  }
}

// 检查是否有 Unknown 数据
const unknownChecks = [
  { field: 'topWebsites', name: '网站' },
  { field: 'topCountries', name: '国家' },
  { field: 'devices', name: '设备' },
  { field: 'adFormats', name: '广告格式' },
];

unknownChecks.forEach(({ field, name }) => {
  if (data[field]) {
    const unknownCount = data[field].filter(item => item.name === 'Unknown').length;
    if (unknownCount > 0) {
      console.log(`  ⚠️  ${name}数据中有 ${unknownCount} 个 'Unknown' 记录`);
    }
  }
});

// 检查收入为0的记录
if (data.summary && data.summary.totalRevenue === 0) {
  console.log('  ⚠️  总收入为 0，可能影响所有基于收入的计算');
}

// 检查必要字段的完整性
const requiredFields = ['date', 'website'];
const sampleRecord = data.samplePreview?.[0];
if (sampleRecord) {
  const missingFields = requiredFields.filter(field => !sampleRecord[field]);
  if (missingFields.length > 0) {
    console.log(`  ⚠️  样本记录缺少必要字段: ${missingFields.join(', ')}`);
  }
}

console.log('\n建议修复的问题:\n');
if (missingCount > 0) {
  console.log('1. 缺失的数据字段可能影响相关的前端功能显示');
}
if (!data.detailedData || data.detailedData.length === 0) {
  console.log('2. detailedData 缺失会影响高级分析功能的准确性');
}
if (!data.detailedAnalytics?.adUnitAdFormatCombination) {
  console.log('3. adUnitAdFormatCombination 缺失会影响广告单元分析功能');
}
if (data.samplePreview && data.samplePreview.length === 0) {
  console.log('4. samplePreview 为空会影响数据预览功能');
}