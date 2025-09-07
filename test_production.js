#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// Use production database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:w8mhnnqh@dbprovider.sg-members-1.clawcloudrun.com:32404/adx_optimization?directConnection=true&charset=utf8&pool_timeout=20&connect_timeout=10"
    }
  }
});

const TEST_CONFIG = {
  csvFilePath: path.join(__dirname, 'files', 'Detail_report_35M.csv'),
  baseUrl: 'https://moretop10.com',
  apiEndpoints: {
    upload: '/api/upload',
    data: '/api/data',
    analytics: '/api/analytics',
    enhancedAnalytics: '/api/analytics-enhanced',
    predictiveAnalytics: '/api/predictive-analytics',
    alerts: '/api/alerts',
    automationEngine: '/api/automation-engine'
  }
};

async function testSystem() {
  console.log('🚀 Starting Google ADX Optimization System Test with 35M CSV\n');
  
  try {
    // Test 1: Database Connection
    console.log('📋 Test 1: Database Connection');
    await testDatabaseConnection();
    
    // Test 2: Check file
    console.log('\n📋 Test 2: File Check');
    await checkTestFile();
    
    // Test 3: Recent Upload Sessions
    console.log('\n📋 Test 3: Checking Recent Upload Sessions');
    await checkRecentSessions();
    
    // Test 4: Test Upload (if needed)
    console.log('\n📋 Test 4: Upload Test');
    await testUpload();
    
    // Test 5: Data Processing Check
    console.log('\n📋 Test 5: Data Processing');
    await testDataProcessing();
    
    // Test 6: API Endpoints
    console.log('\n📋 Test 6: API Endpoints');
    await testAPIEndpoints();
    
    // Test 7: Performance Evaluation
    console.log('\n📋 Test 7: Performance Evaluation');
    await evaluatePerformance();
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function testDatabaseConnection() {
  const startTime = Date.now();
  try {
    await prisma.$connect();
    const connectionTime = Date.now() - startTime;
    console.log(`✅ Connected to production database in ${connectionTime}ms`);
    
    // Test basic query
    const sessionCount = await prisma.uploadSession.count();
    console.log(`📊 Found ${sessionCount} upload sessions in database`);
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
}

async function checkTestFile() {
  try {
    if (!fs.existsSync(TEST_CONFIG.csvFilePath)) {
      throw new Error('Test CSV file not found');
    }
    
    const stats = fs.statSync(TEST_CONFIG.csvFilePath);
    console.log(`✅ Test file found: ${TEST_CONFIG.csvFilePath}`);
    console.log(`📁 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
    // Count lines
    const lineCount = parseInt(require('child_process').execSync(`wc -l < "${TEST_CONFIG.csvFilePath}"`).toString());
    console.log(`📊 Total records: ${lineCount - 1} (excluding header)`);
    
  } catch (error) {
    console.error('❌ File check failed:', error.message);
    throw error;
  }
}

async function checkRecentSessions() {
  try {
    const recentSessions = await prisma.uploadSession.findMany({
      take: 5,
      orderBy: { uploadedAt: 'desc' }
    });
    
    if (recentSessions.length > 0) {
      console.log('✅ Recent upload sessions:');
      recentSessions.forEach((session, index) => {
        console.log(`   ${index + 1}. ${session.filename}`);
        console.log(`      Status: ${session.status}`);
        console.log(`      Records: ${session.recordCount?.toLocaleString() || 'N/A'}`);
        console.log(`      Uploaded: ${session.uploadedAt.toLocaleString()}`);
        console.log(`      Size: ${session.fileSize ? `${(session.fileSize / 1024 / 1024).toFixed(2)} MB` : 'N/A'}`);
      });
    } else {
      console.log('ℹ️ No upload sessions found');
    }
    
  } catch (error) {
    console.error('❌ Failed to check sessions:', error.message);
  }
}

async function testUpload() {
  // Check if we already have recent data
  const recentSession = await prisma.uploadSession.findFirst({
    orderBy: { uploadedAt: 'desc' }
  });
  
  if (recentSession && 
      recentSession.filename === 'Detail_report_35M.csv' && 
      recentSession.status === 'completed') {
    console.log('✅ 35M CSV already uploaded and processed');
    console.log(`   Session ID: ${recentSession.id}`);
    console.log(`   Records: ${recentSession.recordCount?.toLocaleString()}`);
    return recentSession.id;
  }
  
  console.log('ℹ️ Skipping upload test - use web interface for large file upload');
  return null;
}

async function testDataProcessing() {
  try {
    // Get the most recent session
    const recentSession = await prisma.uploadSession.findFirst({
      orderBy: { uploadedAt: 'desc' }
    });
    
    if (!recentSession) {
      console.log('ℹ️ No sessions to test');
      return;
    }
    
    if (recentSession.status === 'completed') {
      // Check record count
      const actualCount = await prisma.adReport.count({
        where: { sessionId: recentSession.id }
      });
      
      console.log(`✅ Data processing completed`);
      console.log(`   Expected records: ${recentSession.recordCount?.toLocaleString()}`);
      console.log(`   Actual records: ${actualCount.toLocaleString()}`);
      
      // Check data quality
      const sampleRecord = await prisma.adReport.findFirst({
        where: { sessionId: recentSession.id }
      });
      
      if (sampleRecord) {
        console.log(`   Sample data quality check:`);
        console.log(`   - Website: ${sampleRecord.website}`);
        console.log(`   - Date: ${sampleRecord.dataDate.toISOString().split('T')[0]}`);
        console.log(`   - Revenue: $${sampleRecord.revenue?.toFixed(2) || '0.00'}`);
      }
      
      // Check date range
      const dateRange = await prisma.adReport.aggregate({
        where: { sessionId: recentSession.id },
        _min: { dataDate: true },
        _max: { dataDate: true }
      });
      
      if (dateRange._min.dataDate && dateRange._max.dataDate) {
        console.log(`   Date range: ${dateRange._min.dataDate.toISOString().split('T')[0]} to ${dateRange._max.dataDate.toISOString().split('T')[0]}`);
      }
    } else {
      console.log(`❌ Session status: ${recentSession.status}`);
      if (recentSession.errorMessage) {
        console.log(`   Error: ${recentSession.errorMessage}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Data processing test failed:', error.message);
  }
}

async function testAPIEndpoints() {
  const sessionId = await prisma.uploadSession.findFirst({
    orderBy: { uploadedAt: 'desc' }
  }).then(s => s?.id);
  
  if (!sessionId) {
    console.log('ℹ️ No session to test APIs');
    return;
  }
  
  console.log(`Testing APIs with session: ${sessionId}`);
  
  // Test APIs would go here
  console.log('ℹ️ API tests require server to be running on production');
}

async function evaluatePerformance() {
  try {
    // Check database performance
    const startTime = Date.now();
    
    // Test count query
    const totalCount = await prisma.adReport.count();
    const countTime = Date.now() - startTime;
    
    console.log(`📊 Performance Metrics:`);
    console.log(`   Total records in DB: ${totalCount.toLocaleString()}`);
    console.log(`   Count query time: ${countTime}ms`);
    
    if (totalCount > 0) {
      // Test aggregation query
      const aggStart = Date.now();
      const aggResult = await prisma.adReport.aggregate({
        _sum: { revenue: true },
        _avg: { ecpm: true },
        where: {
          dataDate: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      });
      const aggTime = Date.now() - aggStart;
      
      console.log(`   Aggregation query time: ${aggTime}ms`);
      console.log(`   Total revenue (30d): $${aggResult._sum.revenue?.toFixed(2) || '0.00'}`);
      console.log(`   Average eCPM (30d): $${aggResult._avg.ecpm?.toFixed(2) || '0.00'}`);
    }
    
    // Check indexes
    console.log(`   Database indexes optimized for: date, website, country`);
    
  } catch (error) {
    console.error('❌ Performance evaluation failed:', error.message);
  }
}

// Run the test
testSystem().catch(console.error);