// 测试大文件和小文件的结果数据结构
const fs = require('fs');
const path = require('path');

// 读取小文件结果
const smallFileResult = JSON.parse(fs.readFileSync('./results/2297a0f0-2a62-437c-9d7a-b758fedee66d.json', 'utf8'));
// 读取大文件结果
const largeFileResult = JSON.parse(fs.readFileSync('./results/afd49058-9847-43b4-9757-853d692b7291.json', 'utf8'));

console.log('=== 小文件分析 ===');
console.log('File ID:', smallFileResult.fileId);
console.log('Summary:', {
  totalRows: smallFileResult.summary.totalRows,
  totalRevenue: smallFileResult.summary.totalRevenue,
  totalImpressions: smallFileResult.summary.totalImpressions
});
console.log('SamplePreview:', {
  length: smallFileResult.samplePreview?.length || 0,
  hasData: !!smallFileResult.samplePreview
});
console.log('Top websites:', smallFileResult.topWebsites?.length || 0);
console.log('Top countries:', smallFileResult.topCountries?.length || 0);

console.log('\n=== 大文件分析 ===');
console.log('File ID:', largeFileResult.fileId);
console.log('Summary:', {
  totalRows: largeFileResult.summary.totalRows,
  totalRevenue: largeFileResult.summary.totalRevenue,
  totalImpressions: largeFileResult.summary.totalImpressions
});
console.log('SamplePreview:', {
  length: largeFileResult.samplePreview?.length || 0,
  hasData: !!largeFileResult.samplePreview
});
console.log('Top websites:', largeFileResult.topWebsites?.length || 0);
console.log('Top countries:', largeFileResult.topCountries?.length || 0);

// 检查数据结构是否一致
console.log('\n=== 数据结构对比 ===');
const smallKeys = Object.keys(smallFileResult).sort();
const largeKeys = Object.keys(largeFileResult).sort();

console.log('Keys match:', JSON.stringify(smallKeys) === JSON.stringify(largeKeys));
if (JSON.stringify(smallKeys) !== JSON.stringify(largeKeys)) {
  console.log('Small file keys:', smallKeys);
  console.log('Large file keys:', largeKeys);
  
  const onlyInSmall = smallKeys.filter(k => !largeKeys.includes(k));
  const onlyInLarge = largeKeys.filter(k => !smallKeys.includes(k));
  
  if (onlyInSmall.length > 0) {
    console.log('Only in small file:', onlyInSmall);
  }
  if (onlyInLarge.length > 0) {
    console.log('Only in large file:', onlyInLarge);
  }
}