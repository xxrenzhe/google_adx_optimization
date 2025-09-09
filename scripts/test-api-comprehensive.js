#!/usr/bin/env node

const http = require('http');
const fs = require('fs');

// 获取第一个可用的fileId
const resultsDir = './results';
const files = fs.readdirSync(resultsDir);
const jsonFiles = files.filter(f => f.endsWith('.json'));
const fileId = jsonFiles[0].replace('.json', '');

console.log(`Testing API with fileId: ${fileId}\n`);

// 测试1: 有fileId的情况
function testWithFileId() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/analytics-enhanced?fileId=${fileId}`,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      console.log('Test 1 - With fileId:');
      console.log(`Status: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          const response = JSON.parse(data);
          console.log('✓ Success - Response has data');
          console.log(`  - Advertiser analysis: ${response.advertiserAnalysis?.length || 0} items`);
          console.log(`  - eCPM buckets: ${response.ecmpBuckets?.length || 0} items`);
        } else {
          console.log('✗ Error response:', data);
        }
        console.log('');
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error(`Request error: ${e.message}`);
      resolve();
    });

    req.end();
  });
}

// 测试2: 没有fileId的情况
function testWithoutFileId() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/analytics-enhanced`,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      console.log('Test 2 - Without fileId:');
      console.log(`Status: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const response = JSON.parse(data);
        if (res.statusCode === 404) {
          console.log('✓ Expected - Returned error for missing fileId');
          console.log(`  - Error: ${response.error}`);
        } else {
          console.log('✗ Unexpected response:', data);
        }
        console.log('');
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error(`Request error: ${e.message}`);
      resolve();
    });

    req.end();
  });
}

// 测试3: 无效的fileId
function testWithInvalidFileId() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/analytics-enhanced?fileId=invalid-file-id`,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      console.log('Test 3 - With invalid fileId:');
      console.log(`Status: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const response = JSON.parse(data);
        if (res.statusCode === 404) {
          console.log('✓ Expected - Returned error for invalid fileId');
          console.log(`  - Error: ${response.error}`);
        } else {
          console.log('✗ Unexpected response:', data);
        }
        console.log('');
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error(`Request error: ${e.message}`);
      resolve();
    });

    req.end();
  });
}

async function runTests() {
  await testWithFileId();
  await testWithoutFileId();
  await testWithInvalidFileId();
  console.log('All tests completed');
}

runTests();