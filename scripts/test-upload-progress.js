#!/usr/bin/env node

/**
 * 测试生产环境上传进度反馈
 * 验证用户在上传阶段是否能立即看到进度反馈
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// 测试配置
const config = {
  hostname: 'www.moretop10.com',
  port: 443,
  path: '/api/upload-optimized',
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data',
    'User-Agent': 'Mozilla/5.0 (Test Script)'
  }
};

// 创建测试CSV文件
function createTestCSV() {
  const csvContent = `Date,Website,Country,Device,AdFormat,Requests,Impressions,Clicks,Revenue,ECPM
2024-01-01,example.com,US,Mobile,Banner,1000,800,10,5.00,6.25
2024-01-01,test.com,UK,Desktop,Interstitial,1500,1200,15,7.50,6.25
2024-01-01,demo.com,CA,Tablet,Video,800,600,8,4.00,6.67`;
  
  fs.writeFileSync('test-upload.csv', csvContent);
  return 'test-upload.csv';
}

// 创建FormData
function createFormData(filePath) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substring(2);
  const fileContent = fs.readFileSync(filePath);
  
  // 构建FormData body
  const formDataParts = [];
  
  // 添加文件部分
  formDataParts.push(
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="file"; filename="test-upload.csv"\r\n`,
    `Content-Type: text/csv\r\n`,
    `\r\n`,
    fileContent,
    `\r\n--${boundary}--\r\n`
  );
  
  // 计算总长度
  const totalLength = formDataParts.reduce((acc, part) => {
    if (Buffer.isBuffer(part)) {
      return acc + part.length;
    }
    return acc + Buffer.byteLength(part, 'utf8');
  }, 0);
  
  return {
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': totalLength.toString()
    },
    body: formDataParts
  };
}

// 测试上传进度
function testUploadProgress() {
  console.log('🚀 开始测试生产环境上传进度反馈...\n');
  
  // 创建测试文件
  const testFile = createTestCSV();
  console.log(`📄 创建测试文件: ${testFile}`);
  
  // 准备请求数据
  const formData = createFormData(testFile);
  
  // 发送请求
  const req = https.request({
    hostname: config.hostname,
    port: config.port,
    path: config.path,
    method: config.method,
    headers: formData.headers
  }, (res) => {
    console.log(`\n📡 响应状态: ${res.statusCode} ${res.statusMessage}`);
    console.log(`📋 响应头: ${JSON.stringify(res.headers, null, 2)}`);
    
    let responseData = '';
    
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(responseData);
        console.log(`\n✅ 上传成功！`);
        console.log(`🆔 文件ID: ${response.fileId}`);
        console.log(`📄 文件名: ${response.fileName}`);
        console.log(`📏 文件大小: ${(response.fileSize / 1024).toFixed(2)} KB`);
        
        // 测试状态查询
        testStatusQuery(response.fileId);
      } catch (error) {
        console.error(`\n❌ 解析响应失败:`, error.message);
        console.log(`📄 原始响应:`, responseData);
      }
      
      // 清理测试文件
      fs.unlinkSync(testFile);
      console.log(`\n🧹 清理测试文件: ${testFile}`);
    });
  });
  
  req.on('error', (error) => {
    console.error(`\n❌ 请求失败:`, error.message);
    fs.unlinkSync(testFile);
  });
  
  // 发送请求体
  formData.body.forEach(part => {
    if (Buffer.isBuffer(part)) {
      req.write(part);
    } else {
      req.write(part, 'utf8');
    }
  });
  
  req.end();
  
  console.log(`\n📤 发送请求到: https://${config.hostname}${config.path}`);
  console.log(`⏳ 等待响应...`);
}

// 测试状态查询
function testStatusQuery(fileId) {
  console.log(`\n🔍 测试状态查询...`);
  
  const statusPath = `/api/upload-optimized?fileId=${fileId}`;
  
  const req = https.request({
    hostname: config.hostname,
    port: config.port,
    path: statusPath,
    method: 'GET'
  }, (res) => {
    let responseData = '';
    
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      try {
        const status = JSON.parse(responseData);
        console.log(`📊 文件状态: ${status.status}`);
        if (status.fileName) {
          console.log(`📄 文件名: ${status.fileName}`);
          console.log(`📏 文件大小: ${(status.fileSize / 1024).toFixed(2)} KB`);
        }
        if (status.progress !== undefined) {
          console.log(`📈 进度: ${status.progress}%`);
        }
        if (status.error) {
          console.log(`⚠️ 错误: ${status.error}`);
        }
      } catch (error) {
        console.error(`❌ 解析状态失败:`, error.message);
      }
    });
  });
  
  req.on('error', (error) => {
    console.error(`❌ 状态查询失败:`, error.message);
  });
  
  req.end();
}

// 运行测试
if (require.main === module) {
  console.log('='.repeat(60));
  console.log('🧪 生产环境上传进度反馈测试');
  console.log('='.repeat(60));
  
  testUploadProgress();
}

module.exports = { testUploadProgress, testStatusQuery };