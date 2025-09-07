#!/usr/bin/env node

const https = require('https');

// 测试生产环境的基本功能
const PROD_URL = 'https://www.moretop10.com';

async function testBasicFunctions() {
    console.log('🔍 测试生产环境基本功能\n');
    
    // 1. 测试主页
    console.log('1. 测试主页访问...');
    try {
        const res = await fetch(`${PROD_URL}`);
        if (res.ok) {
            console.log('✅ 主页正常');
        } else {
            console.log(`❌ 主页异常: ${res.status}`);
        }
    } catch (error) {
        console.log(`❌ 主页访问失败: ${error.message}`);
    }
    
    // 2. 测试上传页面
    console.log('\n2. 测试上传页面...');
    try {
        const res = await fetch(`${PROD_URL}/upload`);
        if (res.ok) {
            console.log('✅ 上传页面可访问');
        } else {
            console.log(`❌ 上传页面异常: ${res.status}`);
        }
    } catch (error) {
        console.log(`❌ 上传页面访问失败: ${error.message}`);
    }
    
    // 3. 测试分析页面
    console.log('\n3. 测试分析页面...');
    try {
        const res = await fetch(`${PROD_URL}/analytics`);
        if (res.ok) {
            console.log('✅ 分析页面可访问');
        } else {
            console.log(`❌ 分析页面异常: ${res.status}`);
        }
    } catch (error) {
        console.log(`❌ 分析页面访问失败: ${error.message}`);
    }
    
    // 4. 检查数据库中的数据
    console.log('\n4. 数据库状态检查...');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: "postgresql://postgres:w8mhnnqh@dbprovider.sg-members-1.clawcloudrun.com:32404/adx_optimization?directConnection=true"
            }
        }
    });
    
    try {
        await prisma.$connect();
        console.log('✅ 数据库连接成功');
        
        // 检查上传会话
        const sessions = await prisma.uploadSession.findMany({
            take: 3,
            orderBy: { uploadedAt: 'desc' }
        });
        
        console.log(`\n📊 最近的上传会话:`);
        sessions.forEach((session, i) => {
            console.log(`   ${i + 1}. ${session.filename}`);
            console.log(`      状态: ${session.status}`);
            console.log(`      时间: ${session.uploadedAt.toLocaleString()}`);
        });
        
        // 检查数据记录
        const totalRecords = await prisma.adReport.count();
        console.log(`\n📈 总数据记录: ${totalRecords.toLocaleString()}`);
        
        if (totalRecords > 0) {
            // 获取最新的数据
            const latest = await prisma.adReport.findFirst({
                orderBy: { dataDate: 'desc' }
            });
            console.log(`最新数据日期: ${latest.dataDate.toISOString().split('T')[0]}`);
        }
        
    } catch (error) {
        console.log(`❌ 数据库错误: ${error.message}`);
    } finally {
        await prisma.$disconnect();
    }
    
    console.log('\n✨ 基本功能测试完成');
}

testBasicFunctions().catch(console.error);