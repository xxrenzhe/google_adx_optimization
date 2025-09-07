#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Test database connection
async function testDatabaseConnection() {
  console.log('🔌 Testing database connection...');
  
  try {
    await prisma.$connect();
    console.log('✅ Database connection successful!');
    
    // Test basic query
    const result = await prisma.uploadSession.findMany({
      take: 1,
      orderBy: { uploadedAt: 'desc' }
    });
    
    console.log(`📊 Found ${result.length} recent upload sessions`);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Test file upload
async function testFileUpload() {
  console.log('🚀 Starting file upload test...');
  
  const filePath = '/Users/jason/Documents/Kiro/google_adx_optimization/files/Detail_report_35M.csv';
  const fileSize = fs.statSync(filePath).size;
  
  console.log(`📁 File: ${filePath}`);
  console.log(`📊 Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
  
  // Read file as buffer
  const fileBuffer = fs.readFileSync(filePath);
  
  // Create form data
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: 'text/csv' });
  formData.append('file', blob, 'Detail_report_35M.csv');
  
  try {
    console.log('⬆️ Uploading file...');
    const response = await fetch('https://moretop10.com/api/upload', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Upload successful!');
      console.log(`📋 Session ID: ${result.sessionId}`);
      console.log(`📈 Records processed: ${result.recordsProcessed.toLocaleString()}`);
      
      // Return session ID for further tests
      return result.sessionId;
    } else {
      console.error('❌ Upload failed:', result.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Upload error:', error.message);
    return null;
  }
}

// Test data retrieval
async function testDataRetrieval(sessionId) {
  console.log('\n🔍 Testing data retrieval...');
  
  try {
    const response = await fetch(`https://moretop10.com/api/data?sessionId=${sessionId}&page=1&limit=10`);
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Data retrieval successful!');
      console.log(`📊 Total records: ${result.totalCount.toLocaleString()}`);
      console.log(`📄 Showing page ${result.page} of ${Math.ceil(result.totalCount / result.limit)}`);
      
      // Show first record
      if (result.data.length > 0) {
        console.log('\n📋 Sample record:');
        console.log(`  网站: ${result.data[0].website}`);
        console.log(`  国家: ${result.data[0].country}`);
        console.log(`  日期: ${result.data[0].dataDate}`);
        console.log(`  收入: $${result.data[0].revenue?.toFixed(2) || '0.00'}`);
        console.log(`  eCPM: $${result.data[0].ecpm?.toFixed(2) || '0.00'}`);
      }
      
      return true;
    } else {
      console.error('❌ Data retrieval failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Data retrieval error:', error.message);
    return false;
  }
}

// Test analytics
async function testAnalytics(sessionId) {
  console.log('\n📈 Testing analytics...');
  
  try {
    const response = await fetch(`https://moretop10.com/api/analytics?sessionId=${sessionId}`);
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Analytics successful!');
      console.log(`📊 Total Revenue: $${result.summary.totalRevenue.toFixed(2)}`);
      console.log(`👁️ Total Impressions: ${result.summary.totalImpressions.toLocaleString()}`);
      console.log(`📈 Average Fill Rate: ${result.summary.avgFillRate.toFixed(2)}%`);
      console.log(`💰 ARPU: $${result.summary.arpu.toFixed(4)}`);
      
      return true;
    } else {
      console.error('❌ Analytics failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Analytics error:', error.message);
    return false;
  }
}

// Test alerts
async function testAlerts(sessionId) {
  console.log('\n🚨 Testing decision alerts...');
  
  try {
    const response = await fetch(`https://moretop10.com/api/alerts?sessionId=${sessionId}`);
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Alerts retrieval successful!');
      console.log(`⚠️ Found ${result.alerts.length} alerts`);
      console.log(`💡 Found ${result.recommendations.length} recommendations`);
      
      // Show sample alerts
      if (result.alerts.length > 0) {
        console.log('\n📋 Sample alerts:');
        result.alerts.slice(0, 3).forEach(alert => {
          console.log(`  - ${alert.title}: ${alert.message}`);
        });
      }
      
      // Show sample recommendations
      if (result.recommendations.length > 0) {
        console.log('\n💡 Sample recommendations:');
        result.recommendations.slice(0, 3).forEach(rec => {
          console.log(`  - ${rec.title}: ${rec.message}`);
        });
      }
      
      return true;
    } else {
      console.error('❌ Alerts retrieval failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Alerts error:', error.message);
    return false;
  }
}

// Test predictive analytics
async function testPredictiveAnalytics(sessionId) {
  console.log('\n🔮 Testing predictive analytics...');
  
  try {
    const response = await fetch(`https://moretop10.com/api/predictive-analytics?sessionId=${sessionId}`);
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Predictive analytics successful!');
      console.log(`📊 Found ${result.predictions.length} predictions`);
      console.log(`🚨 Found ${result.anomalies.length} anomalies`);
      console.log(`💡 Found ${result.insights.length} insights`);
      
      // Show sample prediction
      if (result.predictions.length > 0) {
        console.log('\n📋 Sample prediction:');
        console.log(`  Date: ${result.predictions[0].date}`);
        console.log(`  Predicted Revenue: $${result.predictions[0].predicted.toFixed(2)}`);
        console.log(`  Confidence: ${(result.predictions[0].confidence * 100).toFixed(0)}%`);
      }
      
      return true;
    } else {
      console.error('❌ Predictive analytics failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Predictive analytics error:', error.message);
    return false;
  }
}

// Test enhanced analytics
async function testEnhancedAnalytics(sessionId) {
  console.log('\n🚀 Testing enhanced analytics...');
  
  try {
    const response = await fetch(`https://moretop10.com/api/analytics-enhanced?sessionId=${sessionId}`);
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Enhanced analytics successful!');
      console.log(`📊 Processing time: ${result.meta.processingTime}ms`);
      console.log(`📈 Found ${result.charts.length} chart types`);
      
      return true;
    } else {
      console.error('❌ Enhanced analytics failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Enhanced analytics error:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('🧪 Starting Google ADX Optimization System Tests\n');
  
  // Test database connection first
  const dbConnected = await testDatabaseConnection();
  if (!dbConnected) {
    console.log('❌ Cannot proceed without database connection');
    await prisma.$disconnect();
    return;
  }
  
  // Test file upload
  const sessionId = await testFileUpload();
  if (!sessionId) {
    console.log('❌ Cannot proceed without successful upload');
    return;
  }
  
  // Wait a bit for processing
  console.log('\n⏳ Waiting for processing to complete...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test all features
  const tests = [
    { name: 'Data Retrieval', fn: () => testDataRetrieval(sessionId) },
    { name: 'Analytics', fn: () => testAnalytics(sessionId) },
    { name: 'Decision Alerts', fn: () => testAlerts(sessionId) },
    { name: 'Predictive Analytics', fn: () => testPredictiveAnalytics(sessionId) },
    { name: 'Enhanced Analytics', fn: () => testEnhancedAnalytics(sessionId) }
  ];
  
  const results = [];
  for (const test of tests) {
    const result = await test.fn();
    results.push({ name: test.name, passed: result });
  }
  
  // Summary
  console.log('\n📊 Test Results Summary:');
  console.log('='.repeat(50));
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
  });
  
  console.log('\n' + '='.repeat(50));
  console.log(`🎯 Overall: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! The system is working correctly.');
  } else {
    console.log('⚠️ Some tests failed. Please check the logs above.');
  }
  
  // Cleanup
  await prisma.$disconnect();
}

// Execute tests
runTests().catch(async (error) => {
  console.error('💥 Test execution failed:', error);
  await prisma.$disconnect();
});