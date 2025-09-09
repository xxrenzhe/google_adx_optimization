#!/usr/bin/env node

// 检查孤立的结果文件（没有对应上传文件的结果文件）
const fs = require('fs');

console.log('=== 检查孤立的结果文件 ===\n');

// 获取所有上传文件
const uploads = fs.readdirSync('uploads');
console.log(`上传文件数量: ${uploads.length}`);

// 获取所有结果文件
const results = fs.readdirSync('results')
  .filter(f => f.endsWith('.json'))
  .map(f => f.replace('.json', ''));
console.log(`结果文件数量: ${results.length}\n`);

// 找出孤立的结果文件
const orphaned = results.filter(resultId => !uploads.includes(resultId));

console.log(`孤立的结果文件数量: ${orphaned.length}\n`);

if (orphaned.length > 0) {
  console.log('孤立的结果文件列表:');
  orphaned.forEach((fileId, index) => {
    const resultFile = `results/${fileId}.json`;
    const stats = fs.statSync(resultFile);
    console.log(`${index + 1}. ${fileId} (大小: ${stats.size} bytes)`);
    
    // 检查detailedData是否为空
    const content = fs.readFileSync(resultFile, 'utf-8');
    const result = JSON.parse(content);
    const detailedDataLength = result.detailedData?.length || 0;
    console.log(`   detailedData长度: ${detailedDataLength}`);
    
    if (detailedDataLength === 0) {
      console.log(`   状态: ❌ detailedData为空`);
    } else {
      console.log(`   状态: ⚠️  有数据但上传文件已删除`);
    }
    console.log('');
  });
  
  console.log('\n建议解决方案:');
  console.log('1. 删除这些孤立的结果文件（因为detailedData为空）');
  console.log('2. 或者重新上传对应的CSV文件');
} else {
  console.log('✅ 没有发现孤立的结果文件');
}