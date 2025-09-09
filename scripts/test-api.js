#!/usr/bin/env node

const http = require('http');
const fs = require('fs');

// 获取第一个可用的fileId
const resultsDir = './results';
const files = fs.readdirSync(resultsDir);
const jsonFiles = files.filter(f => f.endsWith('.json'));
const fileId = jsonFiles[0].replace('.json', '');

console.log(`Testing API with fileId: ${fileId}`);

// Test with fileId
const options1 = {
  hostname: 'localhost',
  port: 3000,
  path: `/api/analytics-enhanced?fileId=${fileId}`,
  method: 'GET'
};

// Test without fileId
const options2 = {
  hostname: 'localhost',
  port: 3000,
  path: `/api/analytics-enhanced`,
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      const response = JSON.parse(data);
      console.log('Response keys:', Object.keys(response));
      console.log('Advertiser analysis length:', response.advertiserAnalysis?.length || 0);
      console.log('eCPM buckets length:', response.ecmpBuckets?.length || 0);
    } else {
      console.log('Error response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

req.end();