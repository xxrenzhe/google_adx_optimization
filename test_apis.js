#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const http = require('http');

// Test configuration
const BASE_URL = 'http://localhost:3001';
const TEST_FILE = path.join(__dirname, 'files', 'Detail_report_35M.csv');

// Test results
const results = {
    server: false,
    upload: false,
    data: false,
    analytics: false,
    enhanced: false,
    predictive: false,
    alerts: false,
    automation: false
};

// Helper function for HTTP requests
function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    json: () => Promise.resolve(JSON.parse(data))
                });
            });
        });
        
        req.on('error', reject);
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

// Test 1: Check if server is running
async function testServer() {
    console.log('🔍 Testing server connectivity...');
    try {
        const response = await fetch(`${BASE_URL}/api/data`);
        if (response.ok || response.status === 400) {
            results.server = true;
            console.log('✅ Server is running');
            return true;
        }
    } catch (error) {
        console.log('❌ Server is not responding');
    }
    return false;
}

// Test 2: Test with a smaller file first
async function testSmallFileUpload() {
    console.log('\n📤 Testing with smaller CSV file...');
    
    // Create a small test CSV
    const smallCsv = `网站,国家/地区,日期,Ad Exchange 请求总数,Ad Exchange 展示次数,Ad Exchange 收入
test.com,美国,2023-06-01,1000,500,5.00
test.com,美国,2023-06-02,1200,600,6.00`;
    
    fs.writeFileSync(path.join(__dirname, 'test_small.csv'), smallCsv);
    
    try {
        const formData = `--boundary\r\n` +
            `Content-Disposition: form-data; name="file"; filename="test_small.csv"\r\n` +
            `Content-Type: text/csv\r\n\r\n` +
            `${smallCsv}\r\n` +
            `--boundary--`;
        
        const response = await fetch(`${BASE_URL}/api/upload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'multipart/form-data; boundary=boundary',
                'Content-Length': Buffer.byteLength(formData)
            },
            body: formData
        });
        
        if (response.ok) {
            const result = await response.json();
            results.upload = true;
            console.log('✅ Small file upload successful');
            console.log(`   Session ID: ${result.sessionId}`);
            console.log(`   Records: ${result.recordsProcessed}`);
            return result.sessionId;
        } else {
            const error = await response.json();
            console.log('❌ Upload failed:', error.error);
        }
    } catch (error) {
        console.log('❌ Upload error:', error.message);
    }
    
    // Clean up
    if (fs.existsSync(path.join(__dirname, 'test_small.csv'))) {
        fs.unlinkSync(path.join(__dirname, 'test_small.csv'));
    }
    
    return null;
}

// Test 3: Test data API
async function testDataAPI(sessionId) {
    console.log('\n📊 Testing data API...');
    try {
        const response = await fetch(`${BASE_URL}/api/data?sessionId=${sessionId}&page=1&limit=10`);
        if (response.ok) {
            const data = await response.json();
            results.data = true;
            console.log('✅ Data API working');
            console.log(`   Total records: ${data.totalCount}`);
            return true;
        } else {
            console.log('❌ Data API failed');
        }
    } catch (error) {
        console.log('❌ Data API error:', error.message);
    }
    return false;
}

// Test 4: Test analytics API
async function testAnalyticsAPI(sessionId) {
    console.log('\n📈 Testing analytics API...');
    try {
        const response = await fetch(`${BASE_URL}/api/analytics?sessionId=${sessionId}`);
        if (response.ok) {
            const data = await response.json();
            results.analytics = true;
            console.log('✅ Analytics API working');
            if (data.summary) {
                console.log(`   Revenue: $${data.summary.totalRevenue?.toFixed(2) || '0.00'}`);
            }
            return true;
        } else {
            console.log('❌ Analytics API failed');
        }
    } catch (error) {
        console.log('❌ Analytics API error:', error.message);
    }
    return false;
}

// Test 5: Test enhanced analytics API
async function testEnhancedAPI(sessionId) {
    console.log('\n🚀 Testing enhanced analytics API...');
    try {
        const response = await fetch(`${BASE_URL}/api/analytics-enhanced?sessionId=${sessionId}`);
        if (response.ok) {
            const data = await response.json();
            results.enhanced = true;
            console.log('✅ Enhanced analytics API working');
            return true;
        } else {
            console.log('❌ Enhanced analytics API failed');
        }
    } catch (error) {
        console.log('❌ Enhanced analytics API error:', error.message);
    }
    return false;
}

// Test 6: Test predictive analytics API
async function testPredictiveAPI(sessionId) {
    console.log('\n🔮 Testing predictive analytics API...');
    try {
        const response = await fetch(`${BASE_URL}/api/predictive-analytics?sessionId=${sessionId}`);
        if (response.ok) {
            const data = await response.json();
            results.predictive = true;
            console.log('✅ Predictive analytics API working');
            return true;
        } else {
            console.log('❌ Predictive analytics API failed');
        }
    } catch (error) {
        console.log('❌ Predictive analytics API error:', error.message);
    }
    return false;
}

// Test 7: Test alerts API
async function testAlertsAPI(sessionId) {
    console.log('\n🚨 Testing alerts API...');
    try {
        const response = await fetch(`${BASE_URL}/api/alerts?sessionId=${sessionId}`);
        if (response.ok) {
            const data = await response.json();
            results.alerts = true;
            console.log('✅ Alerts API working');
            return true;
        } else {
            console.log('❌ Alerts API failed');
        }
    } catch (error) {
        console.log('❌ Alerts API error:', error.message);
    }
    return false;
}

// Test 8: Test automation engine API
async function testAutomationAPI(sessionId) {
    console.log('\n🤖 Testing automation engine API...');
    try {
        const response = await fetch(`${BASE_URL}/api/automation-engine?sessionId=${sessionId}`);
        if (response.ok) {
            const data = await response.json();
            results.automation = true;
            console.log('✅ Automation engine API working');
            return true;
        } else {
            console.log('❌ Automation engine API failed');
        }
    } catch (error) {
        console.log('❌ Automation engine API error:', error.message);
    }
    return false;
}

// Main test function
async function runTests() {
    console.log('🧪 Google ADX Optimization System - API Tests\n');
    
    // Test server connectivity
    if (!await testServer()) {
        console.log('\n❌ Cannot proceed - server is not running');
        return;
    }
    
    // Test with small file first
    const sessionId = await testSmallFileUpload();
    if (!sessionId) {
        console.log('\n❌ Cannot proceed without successful upload');
        return;
    }
    
    // Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test all APIs
    await testDataAPI(sessionId);
    await testAnalyticsAPI(sessionId);
    await testEnhancedAPI(sessionId);
    await testPredictiveAPI(sessionId);
    await testAlertsAPI(sessionId);
    await testAutomationAPI(sessionId);
    
    // Print results
    console.log('\n📊 Test Results Summary:');
    console.log('='.repeat(40));
    
    Object.entries(results).forEach(([test, passed]) => {
        console.log(`${passed ? '✅' : '❌'} ${test.charAt(0).toUpperCase() + test.slice(1)}`);
    });
    
    const passedCount = Object.values(results).filter(v => v).length;
    const totalCount = Object.keys(results).length;
    
    console.log('\n' + '='.repeat(40));
    console.log(`🎯 Overall: ${passedCount}/${totalCount} tests passed`);
    
    if (passedCount === totalCount) {
        console.log('\n🎉 All API tests passed!');
        console.log('\n📋 Recommendations:');
        console.log('1. The system is working correctly with small files');
        console.log('2. For large files (35M), consider:');
        console.log('   - Increasing server timeout settings');
        console.log('   - Using chunked upload for better reliability');
        console.log('   - Monitoring server resources during upload');
    } else {
        console.log('\n⚠️ Some APIs are not working as expected');
    }
}

// Run tests
runTests().catch(console.error);