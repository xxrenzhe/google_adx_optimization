#!/usr/bin/env node

// 测试 detailedData 采集逻辑
const DETAILED_DATA_LIMIT = 50000;

function simulateDataCollection(totalRows) {
  const detailedData = [];
  let processedLines = 0;
  
  console.log(`模拟处理 ${totalRows} 行数据...\n`);
  
  for (processedLines = 0; processedLines < totalRows; processedLines++) {
    // 模拟采集逻辑
    if (detailedData.length < DETAILED_DATA_LIMIT) {
      // 使用采样策略：每N条记录收集一条
      const samplingRate = Math.max(1, Math.floor(processedLines / DETAILED_DATA_LIMIT));
      if (processedLines % samplingRate === 0 || detailedData.length < 1000) {
        detailedData.push({
          id: processedLines,
          data: `sample_${processedLines}`
        });
        
        // 记录前几次采集
        if (detailedData.length <= 10) {
          console.log(`第 ${processedLines} 行: 采样率 ${samplingRate}, 已采集 ${detailedData.length} 条`);
        }
      }
    }
  }
  
  console.log(`\n结果:`);
  console.log(`总行数: ${totalRows}`);
  console.log(`采集的数据量: ${detailedData.length}`);
  console.log(`采集比例: ${(detailedData.length / totalRows * 100).toFixed(2)}%`);
  
  return detailedData.length;
}

// 测试不同大小的文件
console.log('=== 测试小文件 (100行) ===');
simulateDataCollection(100);

console.log('\n=== 测试中等文件 (10,000行) ===');
simulateDataCollection(10000);

console.log('\n=== 测试大文件 (100,000行) ===');
simulateDataCollection(100000);

console.log('\n=== 测试超大文件 (1,000,000行) ===');
simulateDataCollection(1000000);