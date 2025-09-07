#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

// 生产环境配置
const PROD_URL = 'https://www.moretop10.com';
const TEST_FILE = path.join(__dirname, 'files', 'Detail_report_35M.csv');

// 测试结果
const testResults = {
    health: false,
    upload: false,
    dataApi: false,
    analytics: false,
    independentAnalysis: false,
    performance: {},
    errors: []
};

// 创建HTTPS请求
function request(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            ...options,
            headers: {
                'User-Agent': 'ADX-Test/1.0',
                ...options.headers
            },
            timeout: 30000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    headers: res.headers,
                    json: () => JSON.parse(data),
                    text: () => data
                });
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

// 测试1: 健康检查
async function testHealth() {
    console.log('🔍 测试服务健康状态...');
    
    try {
        const start = Date.now();
        const res = await request(`${PROD_URL}/api/health`);
        const time = Date.now() - start;
        
        testResults.performance.health = time;
        
        if (res.ok) {
            testResults.health = true;
            console.log(`✅ 服务正常 (响应时间: ${time}ms)`);
            return true;
        } else {
            console.log(`❌ 服务异常: ${res.status}`);
            testResults.errors.push(`健康检查失败: ${res.status}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ 连接失败: ${error.message}`);
        testResults.errors.push(`连接错误: ${error.message}`);
        return false;
    }
}

// 测试2: 文件上传
async function testUpload() {
    console.log('\n📤 测试文件上传...');
    
    if (!fs.existsSync(TEST_FILE)) {
        console.log('❌ 测试文件不存在');
        return false;
    }
    
    const stats = fs.statSync(TEST_FILE);
    console.log(`📁 文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
    try {
        // 读取文件
        const fileData = fs.readFileSync(TEST_FILE);
        
        // 创建form data
        const boundary = '----FormDataBoundary' + Math.random().toString(16).substring(2);
        const formData = [
            `--${boundary}`,
            'Content-Disposition: form-data; name="file"; filename="test.csv"',
            'Content-Type: text/csv',
            '',
            fileData,
            `--${boundary}--`
        ].join('\r\n');
        
        console.log('⏳ 开始上传...');
        const start = Date.now();
        
        const res = await request(`${PROD_URL}/api/upload`, {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': Buffer.byteLength(formData)
            },
            body: formData
        });
        
        const time = Date.now() - start;
        testResults.performance.upload = time;
        
        if (res.ok) {
            const result = res.json();
            testResults.upload = true;
            console.log(`✅ 上传成功!`);
            console.log(`   会话ID: ${result.sessionId}`);
            console.log(`   处理时间: ${time}ms`);
            console.log(`   记录数: ${result.recordsProcessed || 'N/A'}`);
            
            testResults.sessionId = result.sessionId;
            return result.sessionId;
        } else {
            console.log(`❌ 上传失败: ${res.status}`);
            const error = res.text();
            console.log(`   错误信息: ${error}`);
            testResults.errors.push(`上传失败: ${res.status}`);
            return null;
        }
    } catch (error) {
        console.log(`❌ 上传错误: ${error.message}`);
        testResults.errors.push(`上传错误: ${error.message}`);
        return null;
    }
}

// 测试3: 数据API
async function testDataApi(sessionId) {
    console.log('\n📊 测试数据查询API...');
    
    if (!sessionId) {
        console.log('❌ 没有会话ID');
        return false;
    }
    
    try {
        // 等待处理
        console.log('⏳ 等待数据处理...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const start = Date.now();
        const res = await request(`${PROD_URL}/api/data?sessionId=${sessionId}&limit=50`);
        const time = Date.now() - start;
        
        testResults.performance.dataApi = time;
        
        if (res.ok) {
            const data = res.json();
            testResults.dataApi = true;
            console.log(`✅ 数据查询成功!`);
            console.log(`   响应时间: ${time}ms`);
            console.log(`   返回记录: ${data.data?.length || 0}`);
            console.log(`   总记录数: ${data.pagination?.totalCount || 'N/A'}`);
            
            // 测试搜索
            console.log('   测试搜索功能...');
            const searchRes = await request(`${PROD_URL}/api/data?sessionId=${sessionId}&search=test&limit=10`);
            if (searchRes.ok) {
                const searchData = searchRes.json();
                console.log(`   搜索结果: ${searchData.data?.length || 0} 条`);
            }
            
            return true;
        } else {
            console.log(`❌ 查询失败: ${res.status}`);
            testResults.errors.push(`数据查询失败: ${res.status}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ 查询错误: ${error.message}`);
        testResults.errors.push(`数据查询错误: ${error.message}`);
        return false;
    }
}

// 测试4: 分析API
async function testAnalytics(sessionId) {
    console.log('\n📈 测试分析API...');
    
    if (!sessionId) {
        console.log('❌ 没有会话ID');
        return false;
    }
    
    try {
        // 标准分析
        console.log('   测试标准分析...');
        const start1 = Date.now();
        const res1 = await request(`${PROD_URL}/api/analytics?sessionId=${sessionId}`);
        const time1 = Date.now() - start1;
        
        if (res1.ok) {
            const data = res1.json();
            testResults.analytics = true;
            console.log(`   ✅ 标准分析成功 (${time1}ms)`);
            console.log(`      总收入: $${data.summary?.totalRevenue?.toFixed(2) || '0.00'}`);
        }
        
        // 独立分析
        console.log('   测试独立分析...');
        const start2 = Date.now();
        const res2 = await request(`${PROD_URL}/api/analytics-independent?sessionId=${sessionId}`);
        const time2 = Date.now() - start2;
        
        testResults.performance.analytics = Math.max(time1, time2);
        
        if (res2.ok) {
            const data = res2.json();
            testResults.independentAnalysis = true;
            console.log(`   ✅ 独立分析成功 (${time2}ms)`);
            console.log(`      会话记录: ${data.session?.recordCount || 'N/A'}`);
            console.log(`      洞察数量: ${data.insights?.length || 0}`);
        } else {
            console.log(`   ❌ 独立分析失败: ${res2.status}`);
        }
        
        return testResults.analytics || testResults.independentAnalysis;
    } catch (error) {
        console.log(`❌ 分析错误: ${error.message}`);
        testResults.errors.push(`分析错误: ${error.message}`);
        return false;
    }
}

// 主函数
async function main() {
    console.log('🚀 Google ADX生产环境API测试\n');
    console.log('='.repeat(50));
    
    const start = Date.now();
    
    // 执行测试
    const healthOk = await testHealth();
    
    if (healthOk) {
        const sessionId = await testUpload();
        
        if (sessionId) {
            await testDataApi(sessionId);
            await testAnalytics(sessionId);
        }
    }
    
    // 结果汇总
    console.log('\n' + '='.repeat(50));
    console.log('📊 测试结果汇总');
    console.log('='.repeat(50));
    
    const tests = [
        { name: '健康检查', passed: testResults.health },
        { name: '文件上传', passed: testResults.upload },
        { name: '数据查询', passed: testResults.dataApi },
        { name: '数据分析', passed: testResults.analytics || testResults.independentAnalysis }
    ];
    
    tests.forEach(test => {
        console.log(`${test.passed ? '✅' : '❌'} ${test.name}`);
    });
    
    const passed = tests.filter(t => t.passed).length;
    const total = tests.length;
    
    console.log(`\n🎯 通过率: ${passed}/${total}`);
    
    if (passed === total) {
        console.log('\n🎉 所有测试通过！');
    } else {
        console.log('\n⚠️ 部分测试失败');
        testResults.errors.forEach((err, i) => {
            console.log(`   ${i + 1}. ${err}`);
        });
    }
    
    // 性能报告
    console.log('\n⚡ 性能报告:');
    if (testResults.performance.health) {
        console.log(`   健康检查: ${testResults.performance.health}ms`);
    }
    if (testResults.performance.upload) {
        const size = fs.existsSync(TEST_FILE) ? fs.statSync(TEST_FILE).size : 0;
        const speed = (size / 1024 / 1024) / (testResults.performance.upload / 1000);
        console.log(`   上传速度: ${speed.toFixed(2)} MB/s`);
    }
    if (testResults.performance.dataApi) {
        console.log(`   数据查询: ${testResults.performance.dataApi}ms`);
    }
    if (testResults.performance.analytics) {
        console.log(`   数据分析: ${testResults.performance.analytics}ms`);
    }
    
    const totalTime = Date.now() - start;
    console.log(`\n⏱️  总耗时: ${(totalTime / 1000).toFixed(2)}秒`);
    
    // 保存结果
    fs.writeFileSync('test-results.json', JSON.stringify({
        timestamp: new Date().toISOString(),
        results: testResults,
        summary: { passed, total }
    }, null, 2));
}

main().catch(console.error);