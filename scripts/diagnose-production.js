#!/usr/bin/env node

/**
 * 诊断生产环境上传问题
 */

const https = require('https');
const fs = require('fs');

// 测试API端点
async function testAPI(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.moretop10.com',
      port: 443,
      path: endpoint,
      method: method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Diagnostic Script)',
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      const bodyData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsed
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// 创建测试CSV
function createTestCSV() {
  const csv = `Date,Website,Country,Device,AdFormat,Requests,Impressions,Clicks,Revenue,ECPM
2024-01-01,example.com,US,Mobile,Banner,1000,800,10,5.00,6.25
2024-01-02,example.com,US,Mobile,Banner,1200,900,12,6.00,6.67`;
  
  fs.writeFileSync('diagnose-test.csv', csv);
  return fs.readFileSync('diagnose-test.csv');
}

// 主测试函数
async function runDiagnostics() {
  console.log('='.repeat(60));
  console.log('🔍 生产环境上传问题诊断');
  console.log('='.repeat(60));

  // 1. 测试基本的API响应
  console.log('\n1️⃣ 测试基本API响应...');
  try {
    const healthResponse = await testAPI('/api/health');
    console.log(`状态: ${healthResponse.status}`);
    if (healthResponse.status === 200) {
      console.log('✅ API服务正常运行');
    } else {
      console.log('❌ API服务异常');
    }
  } catch (error) {
    console.log('❌ API服务无法访问:', error.message);
  }

  // 2. 测试上传API的GET方法（状态查询）
  console.log('\n2️⃣ 测试上传API状态查询...');
  try {
    const statusResponse = await testAPI('/api/upload-optimized?fileId=test123');
    console.log(`状态: ${statusResponse.status}`);
    console.log('响应:', JSON.stringify(statusResponse.data, null, 2));
  } catch (error) {
    console.log('❌ 状态查询失败:', error.message);
  }

  // 3. 测试不带文件的POST请求
  console.log('\n3️⃣ 测试不带文件的POST请求...');
  try {
    const postResponse = await testAPI('/api/upload-optimized', 'POST', {});
    console.log(`状态: ${postResponse.status}`);
    console.log('响应:', JSON.stringify(postResponse.data, null, 2));
  } catch (error) {
    console.log('❌ POST请求失败:', error.message);
  }

  // 4. 测试配置相关的API
  console.log('\n4️⃣ 测试配置信息...');
  try {
    const configResponse = await testAPI('/api/config');
    console.log(`状态: ${configResponse.status}`);
    if (configResponse.data) {
      console.log('配置信息:', JSON.stringify(configResponse.data, null, 2));
    }
  } catch (error) {
    console.log('❌ 配置查询失败:', error.message);
  }

  // 5. 检查是否有其他相关API
  console.log('\n5️⃣ 测试其他相关API...');
  const endpoints = [
    '/api/analytics',
    '/api/alerts',
    '/api/data'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await testAPI(endpoint);
      console.log(`${endpoint}: ${response.status}`);
    } catch (error) {
      console.log(`${endpoint}: 失败 - ${error.message}`);
    }
  }

  console.log('\n'.repeat(60));
  console.log('📋 诊断完成');
  console.log('='.repeat(60));
}

// 运行诊断
runDiagnostics().catch(console.error);