#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

// 配置
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const TEST_FILE = path.join(__dirname, 'files', 'test_medium_210K.csv');

async function testUpload() {
  console.log('开始测试文件上传...');
  console.log('服务器地址:', SERVER_URL);
  console.log('测试文件:', TEST_FILE);
  
  if (!fs.existsSync(TEST_FILE)) {
    console.error('测试文件不存在:', TEST_FILE);
    return;
  }
  
  const fileStats = fs.statSync(TEST_FILE);
  console.log('文件大小:', (fileStats.size / 1024 / 1024).toFixed(2), 'MB');
  
  try {
    // 创建表单数据
    const form = new FormData();
    form.append('file', fs.createReadStream(TEST_FILE));
    
    console.log('开始上传...');
    const startTime = Date.now();
    
    // 发送上传请求
    const response = await fetch(`${SERVER_URL}/api/upload`, {
      method: 'POST',
      body: form
    });
    
    const endTime = Date.now();
    console.log('上传完成，耗时:', ((endTime - startTime) / 1000).toFixed(2), '秒');
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('上传成功!');
      console.log('Session ID:', result.sessionId);
      console.log('记录数:', result.recordCount);
      console.log('文件名:', result.filename);
      
      // 测试数据查询
      await testDataQuery(result.sessionId);
      
      // 测试分析功能
      await testAnalytics(result.sessionId);
      
    } else {
      console.error('上传失败:', result.error);
    }
    
  } catch (error) {
    console.error('上传出错:', error.message);
  }
}

async function testDataQuery(sessionId) {
  console.log('\n开始测试数据查询...');
  
  try {
    const response = await fetch(`${SERVER_URL}/api/data?sessionId=${sessionId}&limit=100`);
    const result = await response.json();
    
    if (response.ok) {
      console.log('查询成功!');
      console.log('返回记录数:', result.data.length);
      console.log('总记录数:', result.pagination.totalCount);
      console.log('第一行数据:', result.data[0]);
    } else {
      console.error('查询失败:', result.error);
    }
  } catch (error) {
    console.error('查询出错:', error.message);
  }
}

async function testAnalytics(sessionId) {
  console.log('\n开始测试数据分析...');
  
  try {
    const response = await fetch(`${SERVER_URL}/api/analytics?sessionId=${sessionId}`);
    const result = await response.json();
    
    if (response.ok) {
      console.log('分析成功!');
      console.log('总收入:', result.summary.totalRevenue);
      console.log('总展示次数:', result.summary.totalImpressions);
      console.log('平均eCPM:', result.summary.avgECPM);
      console.log('数据点数:', result.charts.revenueByDate.length);
    } else {
      console.error('分析失败:', result.error);
    }
  } catch (error) {
    console.error('分析出错:', error.message);
  }
}

// 执行测试
testUpload().catch(console.error);