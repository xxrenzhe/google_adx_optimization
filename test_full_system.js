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

// Helper for HTTPS requests with proper handling
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

// Test 1: File Upload
async function testFileUpload() {
    console.log('📤 Testing file upload with 35M CSV...');
    
    try {
        // Check file
        if (!fs.existsSync(TEST_FILE)) {
            throw new Error('Test file not found');
        }
        
        const stats = fs.statSync(TEST_FILE);
        console.log(`   File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        
        // Create form data
        const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substring(2);
        const fileContent = fs.readFileSync(TEST_FILE);
        
        const formData = [
            `--${boundary}`,
            'Content-Disposition: form-data; name="file"; filename="Detail_report_35M.csv"',
            'Content-Type: text/csv',
            '',
            fileContent.toString(),
            `--${boundary}--`
        ].join('\r\n');
        
        console.log('   Uploading... (this may take a while)');
        const startTime = Date.now();
        
        const response = await fetch(`${PROD_URL}/api/upload`, {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': Buffer.byteLength(formData)
            },
            body: formData
        });
        
        const uploadTime = Date.now() - startTime;
        testResults.performance.uploadTime = uploadTime;
        
        if (response.ok) {
            const result = await response.json();
            testResults.fileUpload = true;
            console.log(`   ✅ Upload successful!`);
            console.log(`   Session ID: ${result.sessionId}`);
            console.log(`   Records processed: ${result.recordsProcessed?.toLocaleString() || 'N/A'}`);
            console.log(`   Upload time: ${(uploadTime / 1000).toFixed(2)}s`);
            return result.sessionId;
        } else {
            const error = await response.text();
            console.log(`   ❌ Upload failed: ${response.status} ${error}`);
            return null;
        }
    } catch (error) {
        console.log(`   ❌ Upload error: ${error.message}`);
        return null;
    }
}

// Test 2: Data Processing
async function testDataProcessing(sessionId) {
    console.log('\n📊 Testing data processing...');
    
    if (!sessionId) {
        console.log('   ❌ No session ID provided');
        return false;
    }
    
    try {
        // Wait for processing to complete
        console.log('   Waiting for processing to complete...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check progress
        let attempts = 0;
        let isComplete = false;
        
        while (attempts < 20 && !isComplete) {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            try {
                const progressResponse = await fetch(`${PROD_URL}/api/progress?sessionId=${sessionId}`);
                if (progressResponse.ok) {
                    const progress = await progressResponse.json();
                    console.log(`   Attempt ${attempts}: ${progress.processed}/${progress.total} records`);
                    
                    if (progress.status === 'completed') {
                        isComplete = true;
                        testResults.dataProcessing = true;
                        console.log(`   ✅ Processing completed!`);
                        console.log(`   Total records: ${progress.total?.toLocaleString()}`);
                        console.log(`   Processing time: ${progress.processingTime}ms`);
                        testResults.performance.processingTime = progress.processingTime;
                    }
                }
            } catch (e) {
                // Progress endpoint might not be available
            }
        }
        
        if (!isComplete) {
            console.log(`   ❌ Processing did not complete in time`);
        }
        
        return isComplete;
    } catch (error) {
        console.log(`   ❌ Processing check error: ${error.message}`);
        return false;
    }
}

// Test 3: Data Retrieval
async function testDataRetrieval(sessionId) {
    console.log('\n🔍 Testing data retrieval...');
    
    if (!sessionId) {
        console.log('   ❌ No session ID provided');
        return false;
    }
    
    try {
        const startTime = Date.now();
        
        // Test pagination
        const response = await fetch(`${PROD_URL}/api/data?sessionId=${sessionId}&page=1&limit=50`);
        const queryTime = Date.now() - startTime;
        
        testResults.performance.queryTime = queryTime;
        
        if (response.ok) {
            const data = await response.json();
            testResults.dataRetrieval = true;
            console.log(`   ✅ Data retrieval successful!`);
            console.log(`   Total records: ${data.totalCount?.toLocaleString()}`);
            console.log(`   Page ${data.page} of ${Math.ceil(data.totalCount / data.limit)}`);
            console.log(`   Query time: ${queryTime}ms`);
            
            // Test filters
            console.log('   Testing filters...');
            const filterResponse = await fetch(`${PROD_URL}/api/data?sessionId=${sessionId}&website=test.com&limit=10`);
            if (filterResponse.ok) {
                const filteredData = await filterResponse.json();
                console.log(`   Filter results: ${filteredData.totalCount} records`);
            }
            
            return true;
        } else {
            const error = await response.text();
            console.log(`   ❌ Data retrieval failed: ${response.status} ${error}`);
            return false;
        }
    } catch (error) {
        console.log(`   ❌ Data retrieval error: ${error.message}`);
        return false;
    }
}

// Test 4: Analytics
async function testAnalytics(sessionId) {
    console.log('\n📈 Testing analytics...');
    
    if (!sessionId) {
        console.log('   ❌ No session ID provided');
        return false;
    }
    
    try {
        const startTime = Date.now();
        
        const response = await fetch(`${PROD_URL}/api/analytics?sessionId=${sessionId}`);
        const analyticsTime = Date.now() - startTime;
        
        testResults.performance.analyticsTime = analyticsTime;
        
        if (response.ok) {
            const data = await response.json();
            testResults.analytics = true;
            console.log(`   ✅ Analytics successful!`);
            console.log(`   Processing time: ${analyticsTime}ms`);
            
            if (data.summary) {
                console.log(`   Total Revenue: $${data.summary.totalRevenue?.toFixed(2) || '0.00'}`);
                console.log(`   Total Impressions: ${data.summary.totalImpressions?.toLocaleString() || '0'}`);
                console.log(`   Average CTR: ${(data.summary.avgCTR * 100).toFixed(2)}%`);
                console.log(`   Average eCPM: $${data.summary.avgECPM?.toFixed(2) || '0.00'}`);
            }
            
            if (data.charts) {
                console.log(`   Charts generated: ${data.charts.length}`);
            }
            
            return true;
        } else {
            const error = await response.text();
            console.log(`   ❌ Analytics failed: ${response.status} ${error}`);
            return false;
        }
    } catch (error) {
        console.log(`   ❌ Analytics error: ${error.message}`);
        return false;
    }
}

// Test 5: Enhanced Analytics
async function testEnhancedAnalytics(sessionId) {
    console.log('\n🚀 Testing enhanced analytics...');
    
    if (!sessionId) {
        console.log('   ❌ No session ID provided');
        return false;
    }
    
    try {
        const startTime = Date.now();
        
        const response = await fetch(`${PROD_URL}/api/analytics-enhanced?sessionId=${sessionId}`);
        const enhancedTime = Date.now() - startTime;
        
        testResults.performance.enhancedTime = enhancedTime;
        
        if (response.ok) {
            const data = await response.json();
            testResults.enhancedAnalytics = true;
            console.log(`   ✅ Enhanced analytics successful!`);
            console.log(`   Processing time: ${enhancedTime}ms`);
            
            if (data.meta) {
                console.log(`   Records analyzed: ${data.meta.recordCount?.toLocaleString() || '0'}`);
            }
            
            if (data.recommendations) {
                console.log(`   Recommendations: ${data.recommendations.length}`);
                data.recommendations.slice(0, 3).forEach((rec, i) => {
                    console.log(`     ${i + 1}. ${rec.title}: ${rec.message}`);
                });
            }
            
            return true;
        } else {
            const error = await response.text();
            console.log(`   ❌ Enhanced analytics failed: ${response.status} ${error}`);
            return false;
        }
    } catch (error) {
        console.log(`   ❌ Enhanced analytics error: ${error.message}`);
        return false;
    }
}

// Test 6: Predictive Analytics
async function testPredictiveAnalytics(sessionId) {
    console.log('\n🔮 Testing predictive analytics...');
    
    if (!sessionId) {
        console.log('   ❌ No session ID provided');
        return false;
    }
    
    try {
        const startTime = Date.now();
        
        const response = await fetch(`${PROD_URL}/api/predictive-analytics?sessionId=${sessionId}`);
        const predictiveTime = Date.now() - startTime;
        
        testResults.performance.predictiveTime = predictiveTime;
        
        if (response.ok) {
            const data = await response.json();
            testResults.predictiveAnalytics = true;
            console.log(`   ✅ Predictive analytics successful!`);
            console.log(`   Processing time: ${predictiveTime}ms`);
            
            if (data.predictions) {
                console.log(`   Predictions: ${data.predictions.length} days`);
                if (data.predictions.length > 0) {
                    const pred = data.predictions[0];
                    console.log(`   Next day prediction: $${pred.predicted?.toFixed(2)} (${(pred.confidence * 100).toFixed(0)}% confidence)`);
                }
            }
            
            if (data.anomalies) {
                console.log(`   Anomalies detected: ${data.anomalies.length}`);
            }
            
            if (data.insights) {
                console.log(`   Insights: ${data.insights.length}`);
            }
            
            return true;
        } else {
            const error = await response.text();
            console.log(`   ❌ Predictive analytics failed: ${response.status} ${error}`);
            return false;
        }
    } catch (error) {
        console.log(`   ❌ Predictive analytics error: ${error.message}`);
        return false;
    }
}

// Test 7: Alerts
async function testAlerts(sessionId) {
    console.log('\n🚨 Testing alerts system...');
    
    if (!sessionId) {
        console.log('   ❌ No session ID provided');
        return false;
    }
    
    try {
        const startTime = Date.now();
        
        const response = await fetch(`${PROD_URL}/api/alerts?sessionId=${sessionId}`);
        const alertsTime = Date.now() - startTime;
        
        testResults.performance.alertsTime = alertsTime;
        
        if (response.ok) {
            const data = await response.json();
            testResults.alerts = true;
            console.log(`   ✅ Alerts system successful!`);
            console.log(`   Processing time: ${alertsTime}ms`);
            
            if (data.alerts) {
                console.log(`   Alerts generated: ${data.alerts.length}`);
                data.alerts.slice(0, 3).forEach((alert, i) => {
                    console.log(`     ${i + 1}. ${alert.type}: ${alert.message}`);
                });
            }
            
            if (data.recommendations) {
                console.log(`   Recommendations: ${data.recommendations.length}`);
            }
            
            return true;
        } else {
            const error = await response.text();
            console.log(`   ❌ Alerts failed: ${response.status} ${error}`);
            return false;
        }
    } catch (error) {
        console.log(`   ❌ Alerts error: ${error.message}`);
        return false;
    }
}

// Test 8: Automation Engine
async function testAutomationEngine(sessionId) {
    console.log('\n🤖 Testing automation engine...');
    
    if (!sessionId) {
        console.log('   ❌ No session ID provided');
        return false;
    }
    
    try {
        const startTime = Date.now();
        
        const response = await fetch(`${PROD_URL}/api/automation-engine?sessionId=${sessionId}`);
        const automationTime = Date.now() - startTime;
        
        testResults.performance.automationTime = automationTime;
        
        if (response.ok) {
            const data = await response.json();
            testResults.automationEngine = true;
            console.log(`   ✅ Automation engine successful!`);
            console.log(`   Processing time: ${automationTime}ms`);
            
            if (data.rules) {
                console.log(`   Rules evaluated: ${data.rules.length}`);
            }
            
            if (data.actions) {
                console.log(`   Actions triggered: ${data.actions.length}`);
            }
            
            return true;
        } else {
            const error = await response.text();
            console.log(`   ❌ Automation engine failed: ${response.status} ${error}`);
            return false;
        }
    } catch (error) {
        console.log(`   ❌ Automation engine error: ${error.message}`);
        return false;
    }
}

// Main test function
async function runTests() {
    console.log('🧪 Google ADX Optimization System - Full Feature Test\n');
    console.log(`📁 Test file: ${TEST_FILE}`);
    console.log(`🌐 Production URL: ${PROD_URL}\n`);
    
    // Run all tests
    const sessionId = await testFileUpload();
    
    if (sessionId) {
        await testDataProcessing(sessionId);
        await testDataRetrieval(sessionId);
        await testAnalytics(sessionId);
        await testEnhancedAnalytics(sessionId);
        await testPredictiveAnalytics(sessionId);
        await testAlerts(sessionId);
        await testAutomationEngine(sessionId);
    }
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    
    const tests = [
        { name: 'File Upload', passed: testResults.fileUpload },
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
    
    if (passedCount === totalCount) {
        console.log('\n🎉 ALL TESTS PASSED! System is working correctly.\n');
        
        // Performance summary
        console.log('⚡ Performance Metrics:');
        if (testResults.performance.uploadTime) {
            console.log(`   Upload speed: ${(testResults.performance.uploadTime / 1000).toFixed(2)}s`);
        }
        if (testResults.performance.queryTime) {
            console.log(`   Query response: ${testResults.performance.queryTime}ms`);
        }
        if (testResults.performance.analyticsTime) {
            console.log(`   Analytics processing: ${testResults.performance.analyticsTime}ms`);
        }
        
    } else {
        console.log('\n⚠️ Some tests failed. Please check the logs above.\n');
    }
}

// Execute tests
runTests().catch(console.error);