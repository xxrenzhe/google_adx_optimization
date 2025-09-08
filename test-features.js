#!/usr/bin/env node

// 测试脚本：验证没有fileId时API不返回历史数据
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000';

async function testAPIWithoutFileId() {
  console.log('=== 测试没有fileId时API的行为 ===\n');
  
  const apis = [
    '/api/analytics',
    '/api/analytics-enhanced',
    '/api/alerts',
    '/api/predictive-analytics',
    '/api/automation-engine'
  ];
  
  for (const api of apis) {
    try {
      console.log(`测试 ${api}:`);
      const response = await fetch(`${API_BASE}${api}`);
      const data = await response.json();
      
      console.log(`  状态码: ${response.status}`);
      
      if (api === '/api/analytics') {
        console.log(`  总收入: ${data.summary?.totalRevenue || 0}`);
        console.log(`  图表数据: ${data.charts?.revenueByDate?.length || 0} 项`);
      } else if (api === '/api/analytics-enhanced') {
        console.log(`  洞察数量: ${data.insights?.length || 0}`);
        console.log(`  建议数量: ${data.recommendations?.length || 0}`);
      } else if (api === '/api/alerts') {
        console.log(`  警报数量: ${data.alerts?.length || 0}`);
        console.log(`  推荐数量: ${data.recommendations?.length || 0}`);
      } else if (api === '/api/predictive-analytics') {
        console.log(`  预测数量: ${data.predictions?.length || 0}`);
        console.log(`  异常数: ${data.anomalies?.length || 0}`);
      } else if (api === '/api/automation-engine') {
        console.log(`  规则数量: ${data.rules?.length || 0}`);
        console.log(`  动作数量: ${data.actions?.length || 0}`);
      }
      
      console.log('');
    } catch (error) {
      console.log(`  错误: ${error.message}\n`);
    }
  }
}

async function testFrontendBehavior() {
  console.log('=== 前端行为测试指南 ===\n');
  console.log('请在浏览器中执行以下测试步骤：\n');
  
  console.log('1. 刷新页面测试：');
  console.log('   - 刷新页面后，检查"当前文件"模块是否消失');
  console.log('   - 切换到各个tab，确认没有显示任何历史数据\n');
  
  console.log('2. 上传文件测试：');
  console.log('   - 上传一个CSV文件');
  console.log('   - 等待分析完成');
  console.log('   - 切换到各个tab，确认数据显示正常');
  console.log('   - 再切换回"上传数据"tab，确认"当前文件"模块仍然显示\n');
  
  console.log('3. 重新上传测试：');
  console.log('   - 上传新文件');
  console.log('   - 确认旧数据被清除，显示新文件的分析结果\n');
  
  console.log('4. localStorage检查：');
  console.log('   - 打开开发者工具 > Application > Local Storage');
  console.log('   - 刷新页面后，确认upload-optimized相关的数据被清除');
}

// 运行测试
testAPIWithoutFileId();
testFrontendBehavior();