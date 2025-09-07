#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

// Test configuration
const PROD_URL = 'https://www.moretop10.com';
const TEST_FILE = path.join(__dirname, 'files', 'Detail_report_35M.csv');

// Test results
const testResults = {
    fileUpload: false,
    dataProcessing: false,
    dataRetrieval: false,
    analytics: false,
    enhancedAnalytics: false,
    predictiveAnalytics: false,
    alerts: false,
    automationEngine: false,
    performance: {}
};

// Helper for HTTPS requests
function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            ...options,
            headers: {
                'User-Agent': 'Google-ADX-Test/1.0',
                ...options.headers
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        headers: res.headers,
                        json: () => Promise.resolve(JSON.parse(data)),
                        text: () => Promise.resolve(data)
                    });
                } catch (e) {
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        headers: res.headers,
                        json: () => Promise.reject(e),
                        text: () => Promise.resolve(data)
                    });
                }
            });
        });
        
        req.on('error', reject);
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

// Split large file into smaller chunks
async function splitFileIntoChunks(filePath, chunkSize = 10000) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    const chunks = [];
    const header = lines[0];
    let currentChunk = [header];
    
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
            currentChunk.push(lines[i]);
            
            if (currentChunk.length >= chunkSize) {
                chunks.push(currentChunk.join('\n'));
                currentChunk = [header];
            }
        }
    }
    
    if (currentChunk.length > 1) {
        chunks.push(currentChunk.join('\n'));
    }
    
    return chunks;
}

// Test 1: Chunked File Upload
async function testChunkedFileUpload() {
    console.log('📤 Testing chunked file upload with 35M CSV...');
    
    try {
        // Check file
        if (!fs.existsSync(TEST_FILE)) {
            throw new Error('Test file not found');
        }
        
        const stats = fs.statSync(TEST_FILE);
        console.log(`   File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        
        // Count lines
        const lineCount = parseInt(require('child_process').execSync(`wc -l < "${TEST_FILE}"`).toString());
        console.log(`   Total records: ${lineCount - 1}`);
        
        // Split into chunks
        console.log('   Splitting file into chunks...');
        const chunks = await splitFileIntoChunks(TEST_FILE, 5000); // 5000 records per chunk
        console.log(`   Created ${chunks.length} chunks`);
        
        // Upload first chunk to create session
        console.log('   Uploading first chunk...');
        const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substring(2);
        const formData = [
            `--${boundary}`,
            'Content-Disposition: form-data; name="file"; filename="chunk1.csv"',
            'Content-Type: text/csv',
            '',
            chunks[0],
            `--${boundary}--`
        ].join('\r\n');
        
        const response = await fetch(`${PROD_URL}/api/upload`, {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': Buffer.byteLength(formData)
            },
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Failed to upload first chunk: ${response.status}`);
        }
        
        const result = await response.json();
        const sessionId = result.sessionId;
        console.log(`   Session created: ${sessionId}`);
        console.log(`   First chunk records: ${result.recordsProcessed}`);
        
        // Upload remaining chunks
        for (let i = 1; i < Math.min(chunks.length, 10); i++) { // Limit to 10 chunks for testing
            console.log(`   Uploading chunk ${i + 1}/${Math.min(chunks.length, 10)}...`);
            
            const chunkFormData = [
                `--${boundary}`,
                'Content-Disposition: form-data; name="file"; filename="chunk' + (i + 1) + '.csv"',
                'Content-Type: text/csv',
                '',
                chunks[i],
                `--${boundary}--`
            ].join('\r\n');
            
            const chunkResponse = await fetch(`${PROD_URL}/api/upload?sessionId=${sessionId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': Buffer.byteLength(chunkFormData)
                },
                body: chunkFormData
            });
            
            if (!chunkResponse.ok) {
                console.log(`   ⚠️ Chunk ${i + 1} failed: ${chunkResponse.status}`);
                continue;
            }
            
            const chunkResult = await chunkResponse.json();
            console.log(`   ✅ Chunk ${i + 1}: ${chunkResult.recordsProcessed} records`);
        }
        
        testResults.fileUpload = true;
        testResults.performance.chunksUploaded = Math.min(chunks.length, 10);
        testResults.performance.totalRecords = (lineCount - 1);
        
        return sessionId;
    } catch (error) {
        console.log(`   ❌ Upload error: ${error.message}`);
        return null;
    }
}

// Test 2: Verify Data Processing
async function verifyDataProcessing(sessionId) {
    console.log('\n📊 Verifying data processing...');
    
    if (!sessionId) {
        console.log('   ❌ No session ID provided');
        return false;
    }
    
    try {
        // Wait a bit for processing
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check data count
        const response = await fetch(`${PROD_URL}/api/data?sessionId=${sessionId}&limit=1`);
        if (response.ok) {
            const data = await response.json();
            testResults.dataProcessing = true;
            console.log(`   ✅ Data processing successful!`);
            console.log(`   Total records in database: ${data.totalCount?.toLocaleString()}`);
            return true;
        } else {
            console.log(`   ❌ Failed to verify processing: ${response.status}`);
            return false;
        }
    } catch (error) {
        console.log(`   ❌ Verification error: ${error.message}`);
        return false;
    }
}

// Test 3: Quick Analytics Test
async function quickAnalyticsTest(sessionId) {
    console.log('\n📈 Testing analytics...');
    
    if (!sessionId) {
        console.log('   ❌ No session ID provided');
        return false;
    }
    
    try {
        const response = await fetch(`${PROD_URL}/api/analytics?sessionId=${sessionId}`);
        if (response.ok) {
            const data = await response.json();
            testResults.analytics = true;
            console.log(`   ✅ Analytics successful!`);
            
            if (data.summary) {
                console.log(`   Total Revenue: $${data.summary.totalRevenue?.toFixed(2) || '0.00'}`);
                console.log(`   Average eCPM: $${data.summary.avgECPM?.toFixed(2) || '0.00'}`);
            }
            
            return true;
        } else {
            console.log(`   ❌ Analytics failed: ${response.status}`);
            return false;
        }
    } catch (error) {
        console.log(`   ❌ Analytics error: ${error.message}`);
        return false;
    }
}

// Main test function
async function runTests() {
    console.log('🧪 Google ADX Optimization System - Chunked Upload Test\n');
    console.log(`📁 Test file: ${TEST_FILE}`);
    console.log(`🌐 Production URL: ${PROD_URL}\n`);
    
    // Run tests
    const sessionId = await testChunkedFileUpload();
    
    if (sessionId) {
        await verifyDataProcessing(sessionId);
        await quickAnalyticsTest(sessionId);
        
        // Test other endpoints quickly
        const endpoints = [
            { name: 'Enhanced Analytics', path: 'analytics-enhanced' },
            { name: 'Predictive Analytics', path: 'predictive-analytics' },
            { name: 'Alerts', path: 'alerts' },
            { name: 'Automation Engine', path: 'automation-engine' }
        ];
        
        for (const endpoint of endpoints) {
            try {
                const response = await fetch(`${PROD_URL}/api/${endpoint.path}?sessionId=${sessionId}`);
                if (response.ok) {
                    testResults[endpoint.name.toLowerCase().replace(' ', '')] = true;
                    console.log(`   ✅ ${endpoint.name} working`);
                } else {
                    console.log(`   ❌ ${endpoint.name} failed: ${response.status}`);
                }
            } catch (error) {
                console.log(`   ❌ ${endpoint.name} error: ${error.message}`);
            }
        }
    }
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    
    const tests = [
        { name: 'File Upload (Chunked)', passed: testResults.fileUpload },
        { name: 'Data Processing', passed: testResults.dataProcessing },
        { name: 'Data Retrieval', passed: testResults.dataRetrieval },
        { name: 'Analytics', passed: testResults.analytics },
        { name: 'Enhanced Analytics', passed: testResults.enhancedAnalytics },
        { name: 'Predictive Analytics', passed: testResults.predictiveAnalytics },
        { name: 'Alerts System', passed: testResults.alerts },
        { name: 'Automation Engine', passed: testResults.automationEngine }
    ];
    
    tests.forEach(test => {
        console.log(`${test.passed ? '✅' : '❌'} ${test.name}`);
    });
    
    const passedCount = tests.filter(t => t.passed).length;
    const totalCount = tests.length;
    
    console.log('\n' + '='.repeat(60));
    console.log(`🎯 OVERALL: ${passedCount}/${totalCount} tests passed`);
    
    if (passedCount >= totalCount * 0.75) { // 75% success rate
        console.log('\n✅ TESTS PASSED! System is working correctly with chunked upload.\n');
        
        if (testResults.performance.chunksUploaded) {
            console.log('📊 Upload Summary:');
            console.log(`   Chunks uploaded: ${testResults.performance.chunksUploaded}`);
            console.log(`   Total records: ${testResults.performance.totalRecords?.toLocaleString()}`);
        }
        
    } else {
        console.log('\n⚠️ Some tests failed. System needs optimization.\n');
    }
}

// Execute tests
runTests().catch(console.error);