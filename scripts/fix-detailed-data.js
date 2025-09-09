#!/usr/bin/env node

// 解决 detailedData 为空的问题
console.log('=== 修复 detailedData 空数据问题 ===\n');

const fs = require('fs');
const path = require('path');

// 1. 检查系统状态
console.log('1. 检查系统状态:');
const uploads = fs.readdirSync('uploads').sort();
const results = fs.readdirSync('results').filter(f => f.endsWith('.json')).sort();

console.log(`   上传文件数量: ${uploads.length}`);
console.log(`   结果文件数量: ${results.length}\n`);

// 2. 识别有问题但可修复的文件
console.log('2. 检查可修复的文件:');
const repairableFiles = [];

results.forEach(resultFile => {
  const fileId = resultFile.replace('.json', '');
  const resultPath = path.join('results', resultFile);
  const uploadPath = path.join('uploads', fileId);
  
  // 只处理有上传文件但detailedData为空的情况
  if (fs.existsSync(uploadPath)) {
    const content = fs.readFileSync(resultPath, 'utf-8');
    const result = JSON.parse(content);
    
    if (!result.detailedData || result.detailedData.length === 0) {
      repairableFiles.push({
        fileId,
        uploadPath,
        resultPath,
        uploadSize: fs.statSync(uploadPath).size
      });
    }
  }
});

console.log(`   发现 ${repairableFiles.length} 个可修复的文件\n`);

// 3. 修复文件
if (repairableFiles.length > 0) {
  console.log('3. 开始修复文件...');
  
  // 导入修复脚本
  const { execSync } = require('child_process');
  
  repairableFiles.forEach((file, index) => {
    console.log(`\n   修复 ${index + 1}/${repairableFiles.length}: ${file.fileId}`);
    console.log(`   文件大小: ${(file.uploadSize / 1024 / 1024).toFixed(2)} MB`);
    
    try {
      // 运行重新生成脚本
      const output = execSync(`node scripts/regenerate.js ${file.fileId}`, { 
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      
      console.log(`   ✅ 修复成功`);
    } catch (error) {
      console.log(`   ❌ 修复失败: ${error.message}`);
    }
  });
  
  console.log('\n4. 验证修复结果:');
  let successCount = 0;
  
  repairableFiles.forEach(file => {
    const content = fs.readFileSync(file.resultPath, 'utf-8');
    const result = JSON.parse(content);
    
    if (result.detailedData && result.detailedData.length > 0) {
      successCount++;
      console.log(`   ✅ ${file.fileId}: ${result.detailedData.length} 条记录`);
    } else {
      console.log(`   ❌ ${file.fileId}: 仍然为空`);
    }
  });
  
  console.log(`\n   修复成功率: ${successCount}/${repairableFiles.length} (${(successCount/repairableFiles.length*100).toFixed(1)}%)`);
} else {
  console.log('   没有发现需要修复的文件');
}

// 4. 提供解决方案建议
console.log('\n5. 解决方案建议:');
console.log('');
console.log('A. 短期解决方案 (已完成):');
console.log('   - 已重新生成有上传文件的detailedData');
console.log('');
console.log('B. 长期解决方案:');
console.log('   1. 修改文件保留策略，确保上传文件保留更长时间');
console.log('   2. 或者在结果文件中完整保存detailedData');
console.log('   3. 添加定期备份机制');
console.log('');
console.log('C. 预防措施:');
console.log('   - 避免在处理过程中删除上传文件');
console.log('   - 实现增量保存机制');
console.log('   - 添加文件完整性检查');

console.log('\n=== 修复完成 ===');