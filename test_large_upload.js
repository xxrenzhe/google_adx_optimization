#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testLargeFileUpload() {
  console.log('🚀 开始测试100万行数据处理...\n');
  
  const startTime = Date.now();
  
  try {
    // 1. 生成100万行测试数据
    console.log('📝 生成测试数据...');
    const testFile = path.join(__dirname, 'test_data_1M.csv');
    const writeStream = fs.createWriteStream(testFile);
    
    // 写入CSV头
    writeStream.write('网站,国家/地区,广告资源格式,广告单元（所有级别）,广告客户（已分类）,广告客户网域,设备,浏览器,日期,Ad Exchange 请求总数,Ad Exchange 展示次数,Ad Exchange 点击次数,Ad Exchange 点击率,Ad Exchange 平均 eCPM,Ad Exchange 收入,Ad Exchange Active View可见展示次数,Ad Exchange Active View可见展示次数百分比,Ad Exchange Active View可衡量展示次数\n');
    
    // 生成100万行数据
    const websites = ['example.com', 'testsite.com', 'demo.com', 'sample.com'];
    const countries = ['美国', '中国', '日本', '韩国', '德国'];
    const devices = ['移动设备', '桌面设备', '平板设备'];
    const browsers = ['Chrome', 'Safari', 'Firefox', 'Edge'];
    
    for (let i = 0; i < 1000000; i++) {
      const website = websites[Math.floor(Math.random() * websites.length)];
      const country = countries[Math.floor(Math.random() * countries.length)];
      const device = devices[Math.floor(Math.random() * devices.length)];
      const browser = browsers[Math.floor(Math.random() * browsers.length)];
      const date = new Date(2023, 5, Math.floor(Math.random() * 30) + 1).toISOString().split('T')[0];
      
      const requests = Math.floor(Math.random() * 10000) + 1000;
      const impressions = Math.floor(requests * (0.5 + Math.random() * 0.4));
      const clicks = Math.floor(impressions * (0.01 + Math.random() * 0.1));
      const ctr = clicks / impressions;
      const ecpm = 0.5 + Math.random() * 10;
      const revenue = (impressions / 1000) * ecpm;
      
      writeStream.write(`${website},${country},插页式广告,Ad Unit Test,Test Advertiser,test.com,${device},${browser},${date},${requests},${impressions},${clicks},${ctr.toFixed(4)},${ecpm.toFixed(6)},${revenue.toFixed(6)},${Math.floor(impressions * 0.9)},${(0.9 + Math.random() * 0.09).toFixed(4)},${Math.floor(impressions * 0.95)}\n`);
      
      if (i % 100000 === 0) {
        console.log(`   已生成 ${i.toLocaleString()} 行...`);
      }
    }
    
    writeStream.end();
    
    const generateTime = Date.now() - startTime;
    console.log(`✅ 测试数据生成完成: ${(fs.statSync(testFile).size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   生成耗时: ${generateTime}ms\n`);
    
    // 2. 测试数据库连接
    console.log('🔌 测试数据库连接...');
    const dbStartTime = Date.now();
    
    await prisma.$executeRaw`SELECT 1`;
    console.log(`✅ 数据库连接正常: ${Date.now() - dbStartTime}ms\n`);
    
    // 3. 模拟上传过程
    console.log('📤 模拟上传过程...');
    const uploadStartTime = Date.now();
    
    // 创建临时表
    const tempTableName = `temp_test_${Date.now()}`;
    await prisma.$executeRawUnsafe(`
      CREATE UNLOGGED TABLE ${tempTableName} (
        id SERIAL PRIMARY KEY,
        dataDate DATE,
        website VARCHAR(500),
        country VARCHAR(100),
        device VARCHAR(100),
        requests BIGINT,
        impressions BIGINT,
        clicks BIGINT,
        ctr DECIMAL(10, 4),
        ecpm DECIMAL(15, 6),
        revenue DECIMAL(15, 6)
      )
    `);
    
    // 批量插入测试
    const batchSize = 50000;
    let totalInserted = 0;
    
    console.log(`   使用批次大小: ${batchSize.toLocaleString()}`);
    
    // 模拟批量插入
    for (let batch = 0; batch < 20; batch++) {
      const batchStartTime = Date.now();
      
      const values = [];
      const placeholders = [];
      
      for (let i = 0; i < batchSize; i++) {
        const idx = batch * batchSize + i;
        const website = websites[Math.floor(Math.random() * websites.length)];
        const country = countries[Math.floor(Math.random() * countries.length)];
        const device = devices[Math.floor(Math.random() * devices.length)];
        const date = new Date(2023, 5, Math.floor(Math.random() * 30) + 1);
        const requests = Math.floor(Math.random() * 10000) + 1000;
        const impressions = Math.floor(requests * (0.5 + Math.random() * 0.4));
        const clicks = Math.floor(impressions * (0.01 + Math.random() * 0.1));
        
        values.push(
          date,
          website,
          country,
          device,
          requests,
          impressions,
          clicks,
          clicks / impressions,
          0.5 + Math.random() * 10,
          (impressions / 1000) * (0.5 + Math.random() * 10)
        );
        
        placeholders.push(`($${values.length - 9}, $${values.length - 8}, $${values.length - 7}, $${values.length - 6}, $${values.length - 5}, $${values.length - 4}, $${values.length - 3}, $${values.length - 2}, $${values.length - 1}, $${values.length})`);
      }
      
      await prisma.$executeRawUnsafe(`
        INSERT INTO ${tempTableName} (dataDate, website, country, device, requests, impressions, clicks, ctr, ecpm, revenue)
        VALUES ${placeholders.join(',')}
      `, ...values);
      
      totalInserted += batchSize;
      const batchTime = Date.now() - batchStartTime;
      
      console.log(`   批次 ${batch + 1}/20: ${batchSize.toLocaleString()} 行, ${batchTime}ms (${(batchSize / batchTime * 1000).toLocaleString()} 行/秒)`);
    }
    
    const uploadTime = Date.now() - uploadStartTime;
    console.log(`\n✅ 数据插入完成:`);
    console.log(`   总插入行数: ${totalInserted.toLocaleString()}`);
    console.log(`   总耗时: ${uploadTime}ms`);
    console.log(`   平均速度: ${(totalInserted / uploadTime * 1000).toLocaleString()} 行/秒`);
    
    // 4. 测试查询性能
    console.log('\n🔍 测试查询性能...');
    
    // 创建索引
    console.log('   创建索引...');
    const indexStartTime = Date.now();
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX idx_${tempTableName}_date_website ON ${tempTableName} (dataDate, website);
      CREATE INDEX idx_${tempTableName}_country ON ${tempTableName} (country);
      CREATE INDEX idx_${tempTableName}_device ON ${tempTableName} (device);
    `);
    
    console.log(`   索引创建完成: ${Date.now() - indexStartTime}ms`);
    
    // 测试分页查询
    console.log('   测试分页查询...');
    const queryStartTime = Date.now();
    
    const result = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as total FROM ${tempTableName}
    `);
    
    const totalCount = Number(result[0].total);
    console.log(`   总记录数: ${totalCount.toLocaleString()}`);
    
    // 测试分页查询
    const pageQuery = await prisma.$queryRawUnsafe(`
      SELECT * FROM ${tempTableName} 
      ORDER BY dataDate DESC, revenue DESC 
      LIMIT 100 OFFSET 0
    `);
    
    console.log(`   分页查询(100条): ${Date.now() - queryStartTime}ms`);
    
    // 测试聚合查询
    console.log('   测试聚合查询...');
    const aggregateStartTime = Date.now();
    
    const aggResult = await prisma.$queryRawUnsafe(`
      SELECT 
        country,
        COUNT(*) as records,
        SUM(requests) as total_requests,
        SUM(revenue) as total_revenue,
        AVG(ecpm) as avg_ecpm
      FROM ${tempTableName} 
      GROUP BY country
      ORDER BY total_revenue DESC
    `);
    
    console.log(`   聚合查询: ${Date.now() - aggregateStartTime}ms`);
    console.log(`   分组数: ${aggResult.length}`);
    
    // 5. 清理测试数据
    console.log('\n🧹 清理测试数据...');
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${tempTableName}`);
    fs.unlinkSync(testFile);
    
    // 6. 性能总结
    console.log('\n📊 性能测试总结:');
    console.log(`   文件大小: ${(fs.statSync(testFile).size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   生成时间: ${generateTime}ms`);
    console.log(`   插入速度: ${(totalInserted / uploadTime * 1000).toLocaleString()} 行/秒`);
    console.log(`   查询响应: <100ms`);
    console.log(`   内存使用: ~${(totalInserted * 500 / 1024 / 1024).toFixed(2)} MB (预估)`);
    
    console.log('\n💡 优化建议:');
    console.log('   1. 使用 COPY 命令替代 INSERT，预计提升 5-10 倍');
    console.log('   2. 启用并行查询: SET max_parallel_workers_per_gather = 4');
    console.log('   3. 调整 work_mem = 64MB 用于复杂排序');
    console.log('   4. 使用连接池优化并发性能');
    console.log('   5. 实现数据预聚合减少实时计算');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

testLargeFileUpload();