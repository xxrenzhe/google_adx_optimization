#!/usr/bin/env node

// 模拟用户操作：上传文件后访问高级分析页面
console.log('Simulating user workflow...\n');

const http = require('http');

// 1. 首先获取最新的fileId（模拟上传）
const getLatestFileId = () => {
  const fs = require('fs');
  const results = fs.readdirSync('results');
  const jsonFiles = results.filter(f => f.endsWith('.json'));
  const latest = jsonFiles.sort().pop();
  return latest.replace('.json', '');
};

const fileId = getLatestFileId();
console.log(`Using latest fileId: ${fileId}`);

// 2. 模拟访问高级分析页面
const testEnhancedAnalytics = () => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/analytics-enhanced?fileId=${fileId}`,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      console.log(`\n1. Testing enhanced analytics API:`);
      console.log(`   Status: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          const response = JSON.parse(data);
          const hasData = response.advertiserAnalysis?.length > 0;
          console.log(`   Has data: ${hasData ? '✅ YES' : '❌ NO'}`);
          console.log(`   Advertiser analysis items: ${response.advertiserAnalysis?.length || 0}`);
        }
        resolve();
      });
    });

    req.end();
  });
};

// 3. 检查文件是否正确处理
const checkFileProcessing = () => {
  console.log(`\n2. Checking file processing status:`);
  
  const fs = require('fs');
  const resultPath = `results/${fileId}.json`;
  
  try {
    const content = fs.readFileSync(resultPath, 'utf-8');
    const result = JSON.parse(content);
    
    console.log(`   - File exists: ✅`);
    console.log(`   - detailedData length: ${result.detailedData?.length || 0}`);
    console.log(`   - summary.totalRows: ${result.summary?.totalRows || 0}`);
    console.log(`   - topWebsites count: ${result.topWebsites?.length || 0}`);
    
    // 检查数据质量
    if (result.detailedData && result.detailedData.length > 0) {
      const sample = result.detailedData[0];
      console.log(`   - Sample data has required fields: ${!!(sample.date && sample.website)}`);
    }
  } catch (error) {
    console.log(`   - Error reading file: ${error.message}`);
  }
};

// 4. 模拟前端组件状态
const simulateFrontend = () => {
  console.log(`\n3. Simulating frontend state:`);
  console.log(`   - URL would be: http://localhost:3000/?fileId=${fileId}`);
  console.log(`   - Active tab would be: 'enhanced'`);
  console.log(`   - EnhancedAnalytics component would receive fileId: ${fileId}`);
};

async function runTest() {
  await testEnhancedAnalytics();
  checkFileProcessing();
  simulateFrontend();
  
  console.log(`\n✅ Test completed`);
  console.log(`\nIf you're still seeing no data in the UI, possible causes:`);
  console.log(`1. Browser cache - try hard refresh (Cmd+Shift+R)`);
  console.log(`2. fileId not properly set in URL - check URL after upload`);
  console.log(`3. Frontend error - check browser console`);
  console.log(`4. Not on 'enhanced' tab - make sure to click the enhanced analytics tab`);
}

runTest();