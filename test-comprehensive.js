#!/usr/bin/env node

// Test script to validate the implementation
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

async function testAPIs() {
  console.log('\n=== Testing API Endpoints Without fileId ===\n');
  
  const apis = [
    '/api/analytics',
    '/api/analytics-enhanced',
    '/api/alerts',
    '/api/predictive-analytics',
    '/api/automation-engine'
  ];
  
  for (const api of apis) {
    try {
      const response = await fetch(`${BASE_URL}${api}`);
      const data = await response.json();
      
      console.log(`${api}:`);
      console.log(`  Status: ${response.status}`);
      console.log(`  Has error: ${!!data.error}`);
      
      if (data.summary) {
        console.log(`  Total Revenue: ${data.summary.totalRevenue || 0}`);
      }
      if (data.insights) {
        console.log(`  Insights count: ${data.insights.length}`);
      }
      if (data.alerts) {
        console.log(`  Alerts count: ${data.alerts.length}`);
      }
      if (data.predictions) {
        console.log(`  Predictions count: ${data.predictions.length}`);
      }
      console.log('');
    } catch (error) {
      console.log(`${api}: Error - ${error.message}\n`);
    }
  }
}

async function testFileUpload() {
  console.log('\n=== Testing File Upload ===\n');
  
  const csvContent = fs.readFileSync(path.join(__dirname, 'Detail_report.csv'));
  const formData = new FormData();
  formData.append('file', new Blob([csvContent], { type: 'text/csv' }), 'Detail_report.csv');
  
  try {
    const response = await fetch(`${BASE_URL}/api/upload-optimized`, {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    console.log('Upload response:');
    console.log(`  Status: ${response.status}`);
    console.log(`  FileId: ${result.fileId}`);
    console.log(`  Message: ${result.message}`);
    
    if (response.ok) {
      return result.fileId;
    } else {
      console.log(`  Error: ${result.error}`);
      return null;
    }
  } catch (error) {
    console.log(`Upload error: ${error.message}`);
    return null;
  }
}

async function testFileStatus(fileId) {
  console.log('\n=== Testing File Status ===\n');
  
  if (!fileId) {
    console.log('No fileId to test');
    return;
  }
  
  let attempts = 0;
  const maxAttempts = 30;
  
  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${BASE_URL}/api/result/${fileId}`);
      const data = await response.json();
      
      console.log(`Attempt ${attempts + 1}: Status = ${data.status}, Progress = ${data.progress || 0}%`);
      
      if (data.status === 'completed') {
        console.log('\n✅ File processing completed!');
        return true;
      } else if (data.status === 'failed') {
        console.log(`\n❌ Processing failed: ${data.error}`);
        return false;
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.log(`Error checking status: ${error.message}`);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n❌ Processing timed out');
  return false;
}

async function testAPIsWithFileId(fileId) {
  console.log('\n=== Testing API Endpoints With fileId ===\n');
  
  if (!fileId) {
    console.log('No fileId to test');
    return;
  }
  
  const apis = [
    `/api/analytics?fileId=${fileId}`,
    `/api/analytics-enhanced?fileId=${fileId}`,
    `/api/alerts?fileId=${fileId}`,
    `/api/predictive-analytics?fileId=${fileId}`,
    `/api/automation-engine?fileId=${fileId}`
  ];
  
  for (const api of apis) {
    try {
      const response = await fetch(`${BASE_URL}${api}`);
      const data = await response.json();
      
      console.log(`${api}:`);
      console.log(`  Status: ${response.status}`);
      console.log(`  Has error: ${!!data.error}`);
      
      if (data.summary) {
        console.log(`  Total Revenue: ${data.summary.totalRevenue || 0}`);
        console.log(`  Total Impressions: ${data.summary.totalImpressions || 0}`);
      }
      if (data.insights) {
        console.log(`  Insights count: ${data.insights.length}`);
      }
      if (data.alerts) {
        console.log(`  Alerts count: ${data.alerts.length}`);
      }
      console.log('');
    } catch (error) {
      console.log(`${api}: Error - ${error.message}\n`);
    }
  }
}

async function main() {
  console.log('🧪 Starting Comprehensive Test\n');
  
  // Test 1: APIs without fileId
  await testAPIs();
  
  // Test 2: File upload
  const fileId = await testFileUpload();
  
  // Test 3: File processing
  if (fileId) {
    const success = await testFileStatus(fileId);
    
    if (success) {
      // Test 4: APIs with fileId
      await testAPIsWithFileId(fileId);
      
      console.log('\n🎉 All tests completed!');
      console.log('\nManual Testing Checklist:');
      console.log('1. Open http://localhost:3000 in browser');
      console.log('2. Verify no data is shown initially');
      console.log('3. Upload Detail_report.csv');
      console.log('4. Verify analysis results appear');
      console.log('5. Switch between tabs - data should persist');
      console.log('6. Refresh page (F5) - data should be cleared');
      console.log('7. Upload again - new data should replace old');
    }
  }
}

main().catch(console.error);