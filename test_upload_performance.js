const fs = require('fs');
const path = require('path');

// 测试文件上传和处理性能
async function testUploadPerformance() {
  const filePath = path.join(__dirname, 'files', 'Detail_report_35M.csv');
  
  console.log('🚀 开始测试文件处理性能...\n');
  
  // 1. 测试文件读取速度
  console.log('📖 测试文件读取速度...');
  const startTime = Date.now();
  
  const stats = fs.statSync(filePath);
  console.log(`   文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  
  let lineCount = 0;
  const readStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  
  readStream.on('data', (chunk) => {
    const lines = chunk.split('\n');
    lineCount += lines.length - 1;
  });
  
  readStream.on('end', () => {
    const readTime = Date.now() - startTime;
    console.log(`   读取完成: ${lineCount} 行`);
    console.log(`   读取速度: ${(stats.size / 1024 / 1024 / (readTime / 1000)).toFixed(2)} MB/s`);
    console.log(`   总耗时: ${readTime}ms\n`);
    
    // 2. 模拟内存使用
    console.log('💾 测试内存使用情况...');
    const memoryStart = process.memoryUsage();
    console.log(`   初始内存使用: ${(memoryStart.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    
    // 模拟批量处理
    const batchSize = 5000;
    const batches = Math.ceil(lineCount / batchSize);
    console.log(`   批次大小: ${batchSize}`);
    console.log(`   总批次数: ${batches}`);
    
    // 估算内存使用
    const estimatedMemoryPerRecord = 500; // 字节/记录
    const totalEstimatedMemory = lineCount * estimatedMemoryPerRecord / 1024 / 1024;
    console.log(`   预估内存需求: ${totalEstimatedMemory.toFixed(2)} MB`);
    
    // 3. 性能分析
    console.log('\n📊 性能分析:');
    console.log(`   - 当前系统使用 ${batchSize} 条记录/批`);
    console.log(`   - 对于100万行数据，需要 ${Math.ceil(1000000 / batchSize)} 次数据库插入`);
    console.log(`   - 建议增大批次大小到 50000-100000 以减少数据库往返`);
    
    // 4. 建议优化
    console.log('\n💡 优化建议:');
    console.log('   1. 使用 PostgreSQL COPY 命令替代批量 INSERT');
    console.log('   2. 增大批次大小到 50000-100000');
    console.log('   3. 实现真正的流式处理，避免内存累积');
    console.log('   4. 添加数据预处理步骤');
    console.log('   5. 优化数据库索引');
    
    process.exit(0);
  });
  
  readStream.on('error', (error) => {
    console.error('❌ 文件读取错误:', error);
    process.exit(1);
  });
}

testUploadPerformance();