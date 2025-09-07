#!/usr/bin/env node

// Google ADX Optimization System - 部署后验证测试
// 使用方法: node verify-deployment.js

const https = require('https');
const { execSync } = require('child_process');

const PROD_URL = 'https://www.moretop10.com';
const tests = [];

// 测试结果
const results = {
    passed: 0,
    failed: 0,
    details: []
};

// 测试工具函数
async function testApi(endpoint, description, options = {}) {
    console.log(`🔍 测试: ${description}...`);
    
    return new Promise((resolve) => {
        const req = https.request(`${PROD_URL}${endpoint}`, {
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'ADX-Verify/1.0',
                ...options.headers
            },
            timeout: 10000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const result = {
                    name: description,
                    endpoint: endpoint,
                    status: res.statusCode,
                    success: res.statusCode >= 200 && res.statusCode < 300
                };
                
                if (result.success) {
                    console.log(`   ✅ 成功 (${res.statusCode}ms)`);
                    results.passed++;
                } else {
                    console.log(`   ❌ 失败 (${res.statusCode})`);
                    results.failed++;
                }
                
                results.details.push(result);
                resolve(result);
            });
        });
        
        req.on('error', (error) => {
            console.log(`   ❌ 错误: ${error.message}`);
            results.failed++;
            results.details.push({
                name: description,
                endpoint: endpoint,
                status: 'ERROR',
                success: false,
                error: error.message
            });
            resolve(null);
        });
        
        req.on('timeout', () => {
            req.destroy();
            console.log(`   ❌ 超时`);
            results.failed++;
            results.details.push({
                name: description,
                endpoint: endpoint,
                status: 'TIMEOUT',
                success: false
            });
            resolve(null);
        });
        
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

// 主测试函数
async function runTests() {
    console.log('🚀 Google ADX 系统部署验证测试\n');
    console.log('='.repeat(60));
    
    const startTime = Date.now();
    
    // 1. 基础连接测试
    console.log('📡 1. 基础连接测试');
    console.log('-'.repeat(40));
    
    await testApi('/', '主页访问');
    await testApi('/api/health', '健康检查API');
    
    // 2. 上传功能测试
    console.log('\n📤 2. 上传功能测试');
    console.log('-'.repeat(40));
    
    await testApi('/api/upload', '上传API可用性', { method: 'POST' });
    
    // 3. 数据API测试
    console.log('\n📊 3. 数据API测试');
    console.log('-'.repeat(40));
    
    await testApi('/api/data?limit=10', '数据查询API');
    
    // 4. 分析API测试
    console.log('\n📈 4. 分析API测试');
    console.log('-'.repeat(40));
    
    await testApi('/api/analytics', '标准分析API');
    await testApi('/api/analytics-independent', '独立分析API');
    
    // 5. 清理API测试（需要密钥）
    console.log('\n🧹 5. 清理API测试');
    console.log('-'.repeat(40));
    
    await testApi('/api/data-cleanup', '数据清理API');
    await testApi('/api/cache-cleanup', '缓存清理API');
    
    // 6. 性能测试
    console.log('\n⚡ 6. 性能测试');
    console.log('-'.repeat(40));
    
    const perfStart = Date.now();
    await testApi('/api/health', '健康检查性能');
    const perfTime = Date.now() - perfStart;
    console.log(`   响应时间: ${perfTime}ms`);
    
    // 测试结果汇总
    console.log('\n' + '='.repeat(60));
    console.log('📊 测试结果汇总');
    console.log('='.repeat(60));
    
    console.log(`✅ 通过: ${results.passed}`);
    console.log(`❌ 失败: ${results.failed}`);
    console.log(`📈 成功率: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
    
    // 显示失败的测试
    if (results.failed > 0) {
        console.log('\n❌ 失败的测试:');
        results.details
            .filter(t => !t.success)
            .forEach(t => {
                console.log(`   - ${t.name}: ${t.status} ${t.error || ''}`);
            });
    }
    
    // 生成报告
    const report = {
        timestamp: new Date().toISOString(),
        totalTime: Date.now() - startTime,
        summary: {
            passed: results.passed,
            failed: results.failed,
            successRate: (results.passed / (results.passed + results.failed)) * 100
        },
        details: results.details
    };
    
    // 保存报告
    const fs = require('fs');
    fs.writeFileSync('verification-report.json', JSON.stringify(report, null, 2));
    console.log(`\n📄 详细报告已保存到: verification-report.json`);
    
    // 建议
    console.log('\n💡 建议:');
    if (results.failed === 0) {
        console.log('- 所有测试通过，系统运行正常');
        console.log('- 建议定期运行此脚本进行监控');
    } else {
        console.log('- 有测试失败，请检查相关服务');
        console.log('- 查看容器日志排查问题');
        console.log('- 确认所有环境变量已正确配置');
    }
    
    console.log('\n✨ 验证测试完成');
}

// 数据库连接测试（可选）
function testDatabaseConnection() {
    console.log('\n🗄️  数据库连接测试（可选）');
    console.log('-'.repeat(40));
    
    try {
        // 这里需要安装 @prisma/client
        console.log('   跳过数据库测试（需要客户端）');
    } catch (error) {
        console.log(`   ❌ 无法测试数据库: ${error.message}`);
    }
}

// 执行测试
runTests().catch(console.error);