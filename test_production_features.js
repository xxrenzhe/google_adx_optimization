#!/usr/bin/env node

const https = require('https');

// Test configuration
const PROD_URL = 'https://www.moretop10.com';

// Test results
const testResults = {
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

// Test 1: Data Retrieval (without session)
async function testDataRetrieval() {
    console.log('🔍 Testing data retrieval...');
    
    try {
        const startTime = Date.now();
        
        // Test pagination
        const response = await fetch(`${PROD_URL}/api/data?page=1&limit=50`);
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
            const filterResponse = await fetch(`${PROD_URL}/api/data?website=test.com&limit=10`);
            if (filterResponse.ok) {
                const filteredData = await filterResponse.json();
                console.log(`   Filter results: ${filteredData.totalCount} records`);
            }
            
            // Test search
            console.log('   Testing search...');
            const searchResponse = await fetch(`${PROD_URL}/api/data?search=qwerpdf&limit=10`);
            if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                console.log(`   Search results: ${searchData.totalCount} records`);
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

// Test 2: Analytics (without session)
async function testAnalytics() {
    console.log('\n📈 Testing analytics...');
    
    try {
        const startTime = Date.now();
        
        const response = await fetch(`${PROD_URL}/api/analytics`);
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
                console.log(`   Average Fill Rate: ${data.summary.avgFillRate?.toFixed(2)}%`);
            }
            
            if (data.charts) {
                console.log(`   Charts generated: ${data.charts.length}`);
                data.charts.forEach(chart => {
                    console.log(`     - ${chart.type}: ${chart.data.length} data points`);
                });
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

// Test 3: Enhanced Analytics
async function testEnhancedAnalytics() {
    console.log('\n🚀 Testing enhanced analytics...');
    
    try {
        const startTime = Date.now();
        
        const response = await fetch(`${PROD_URL}/api/analytics-enhanced`);
        const enhancedTime = Date.now() - startTime;
        
        testResults.performance.enhancedTime = enhancedTime;
        
        if (response.ok) {
            const data = await response.json();
            testResults.enhancedAnalytics = true;
            console.log(`   ✅ Enhanced analytics successful!`);
            console.log(`   Processing time: ${enhancedTime}ms`);
            
            if (data.meta) {
                console.log(`   Records analyzed: ${data.meta.recordCount?.toLocaleString() || '0'}`);
                console.log(`   Processing time: ${data.meta.processingTime}ms`);
            }
            
            if (data.recommendations) {
                console.log(`   Recommendations: ${data.recommendations.length}`);
                data.recommendations.slice(0, 5).forEach((rec, i) => {
                    console.log(`     ${i + 1}. ${rec.title}`);
                    console.log(`        ${rec.message}`);
                });
            }
            
            if (data.charts) {
                console.log(`   Chart types: ${Object.keys(data.charts).join(', ')}`);
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

// Test 4: Predictive Analytics
async function testPredictiveAnalytics() {
    console.log('\n🔮 Testing predictive analytics...');
    
    try {
        const startTime = Date.now();
        
        const response = await fetch(`${PROD_URL}/api/predictive-analytics`);
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
                    console.log('   Next 7 days predictions:');
                    data.predictions.slice(0, 7).forEach((pred, i) => {
                        console.log(`     Day ${i + 1}: $${pred.predicted?.toFixed(2)} (${(pred.confidence * 100).toFixed(0)}%)`);
                    });
                }
            }
            
            if (data.anomalies) {
                console.log(`   Anomalies detected: ${data.anomalies.length}`);
                data.anomalies.slice(0, 3).forEach(anomaly => {
                    console.log(`     - ${anomaly.date}: ${anomaly.description}`);
                });
            }
            
            if (data.insights) {
                console.log(`   Insights: ${data.insights.length}`);
                data.insights.slice(0, 3).forEach(insight => {
                    console.log(`     - ${insight.type}: ${insight.message}`);
                });
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

// Test 5: Alerts
async function testAlerts() {
    console.log('\n🚨 Testing alerts system...');
    
    try {
        const startTime = Date.now();
        
        const response = await fetch(`${PROD_URL}/api/alerts`);
        const alertsTime = Date.now() - startTime;
        
        testResults.performance.alertsTime = alertsTime;
        
        if (response.ok) {
            const data = await response.json();
            testResults.alerts = true;
            console.log(`   ✅ Alerts system successful!`);
            console.log(`   Processing time: ${alertsTime}ms`);
            
            if (data.alerts) {
                console.log(`   Alerts generated: ${data.alerts.length}`);
                const alertTypes = {};
                data.alerts.forEach(alert => {
                    alertTypes[alert.type] = (alertTypes[alert.type] || 0) + 1;
                });
                console.log('   Alert types:');
                Object.entries(alertTypes).forEach(([type, count]) => {
                    console.log(`     - ${type}: ${count}`);
                });
            }
            
            if (data.recommendations) {
                console.log(`   Recommendations: ${data.recommendations.length}`);
                data.recommendations.slice(0, 5).forEach((rec, i) => {
                    console.log(`     ${i + 1}. ${rec.priority} - ${rec.message}`);
                });
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

// Test 6: Automation Engine
async function testAutomationEngine() {
    console.log('\n🤖 Testing automation engine...');
    
    try {
        const startTime = Date.now();
        
        const response = await fetch(`${PROD_URL}/api/automation-engine`);
        const automationTime = Date.now() - startTime;
        
        testResults.performance.automationTime = automationTime;
        
        if (response.ok) {
            const data = await response.json();
            testResults.automationEngine = true;
            console.log(`   ✅ Automation engine successful!`);
            console.log(`   Processing time: ${automationTime}ms`);
            
            if (data.rules) {
                console.log(`   Rules evaluated: ${data.rules.length}`);
                const triggeredRules = data.rules.filter(rule => rule.triggered);
                console.log(`   Rules triggered: ${triggeredRules.length}`);
                
                if (triggeredRules.length > 0) {
                    console.log('   Triggered rules:');
                    triggeredRules.slice(0, 3).forEach(rule => {
                        console.log(`     - ${rule.name}: ${rule.action}`);
                    });
                }
            }
            
            if (data.actions) {
                console.log(`   Actions executed: ${data.actions.length}`);
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
    console.log('🧪 Google ADX Optimization System - Production Test\n');
    console.log(`🌐 Production URL: ${PROD_URL}`);
    console.log('📊 Testing with existing data in database\n');
    
    // Run all tests
    await testDataRetrieval();
    await testAnalytics();
    await testEnhancedAnalytics();
    await testPredictiveAnalytics();
    await testAlerts();
    await testAutomationEngine();
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    
    const tests = [
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
        if (testResults.performance.queryTime) {
            console.log(`   Query response: ${testResults.performance.queryTime}ms`);
        }
        if (testResults.performance.analyticsTime) {
            console.log(`   Analytics processing: ${testResults.performance.analyticsTime}ms`);
        }
        if (testResults.performance.enhancedTime) {
            console.log(`   Enhanced analytics: ${testResults.performance.enhancedTime}ms`);
        }
        if (testResults.performance.predictiveTime) {
            console.log(`   Predictive analytics: ${testResults.performance.predictiveTime}ms`);
        }
        
    } else {
        console.log('\n⚠️ Some tests failed. Please check the logs above.\n');
    }
}

// Execute tests
runTests().catch(console.error);