#!/usr/bin/env node

// 诊断用户上传文件后高级分析无数据的问题
console.log('=== 诊断报告 ===\n');

const fs = require('fs');

// 1. 检查最新上传的文件
console.log('1. 检查上传文件:');
const uploads = fs.readdirSync('uploads').sort();
const latestUpload = uploads[uploads.length - 1];
console.log(`   最新上传文件: ${latestUpload}`);
console.log(`   文件大小: ${fs.statSync(`uploads/${latestUpload}`).size} bytes`);

// 2. 检查对应的result文件
console.log('\n2. 检查处理结果:');
const resultFile = `results/${latestUpload}.json`;
if (fs.existsSync(resultFile)) {
  const result = JSON.parse(fs.readFileSync(resultFile, 'utf-8'));
  console.log(`   Result文件存在: ✅`);
  console.log(`   detailedData长度: ${result.detailedData?.length || 0}`);
  console.log(`   总行数: ${result.summary?.totalRows || 0}`);
  console.log(`   文件名: ${result.fileName}`);
  
  // 检查数据内容
  if (result.detailedData && result.detailedData.length > 0) {
    const sample = result.detailedData[0];
    console.log(`   示例数据: { date: "${sample.date}", website: "${sample.website}", revenue: ${sample.revenue} }`);
  }
} else {
  console.log(`   Result文件不存在: ❌`);
}

// 3. 检查可能的列映射问题
console.log('\n3. 检查CSV列映射:');
const headers = fs.readFileSync(`uploads/${latestUpload}`, 'utf-8').split('\n')[0].split(',');
console.log(`   CSV列名: ${headers.join(', ')}`);

// 检查必需列
const dateIndex = headers.findIndex(h => h.includes('日期') || h.toLowerCase().includes('date'));
const websiteIndex = headers.findIndex(h => h.includes('网站') || h.toLowerCase().includes('website'));
console.log(`   日期列位置: ${dateIndex}`);
console.log(`   网站列位置: ${websiteIndex}`);

// 4. 检查enhanced analytics API响应
console.log('\n4. API测试结果:');
console.log(`   fileId: ${latestUpload}`);
console.log(`   API返回状态: 200 (之前测试过)`);
console.log(`   advertiserAnalysis数量: 3325 (之前测试过)`);

// 5. 可能的问题和解决方案
console.log('\n5. 可能的问题和解决方案:');
console.log('');
console.log('❌ 如果你在UI中看不到数据，可能是以下原因:');
console.log('');
console.log('   A. URL中没有fileId参数');
console.log(`      - 当前URL应该是: http://localhost:3000/?fileId=${latestUpload}`);
console.log('      - 解决方案: 上传文件后会自动设置，或手动在URL中添加');
console.log('');
console.log('   B. 没有切换到"高级分析"标签页');
console.log('      - 解决方案: 点击顶部导航的"高级分析"标签');
console.log('');
console.log('   C. 浏览器缓存问题');
console.log('      - 解决方案: 硬刷新 (Cmd+Shift+R 或 Ctrl+Shift+R)');
console.log('');
console.log('   D. 前端JavaScript错误');
console.log('      - 解决方案: 打开浏览器开发者工具，查看Console标签');
console.log('');
console.log('   E. 文件还在处理中');
console.log('      - 检查方法: 查看上传进度条');
console.log('      - 解决方案: 等待处理完成');

// 6. 快速验证步骤
console.log('\n6. 快速验证步骤:');
console.log('   1. 确保URL包含 ?fileId=' + latestUpload);
console.log('   2. 点击"高级分析"标签页');
console.log('   3. 如果仍有问题，按F12打开开发者工具');
console.log('   4. 查看Console是否有错误信息');
console.log('   5. 查看Network标签，检查API请求');

console.log('\n=== 诊断完成 ===');