#!/usr/bin/env node

// 增强诊断工具 - 检查前端状态和API响应
console.log('=== 增强诊断工具 ===\n');

const fs = require('fs');
const http = require('http');

// 1. 检查文件状态
function checkFileStatus() {
  console.log('1. 文件状态检查:');
  const uploads = fs.readdirSync('uploads').sort();
  const results = fs.readdirSync('results').filter(f => f.endsWith('.json')).sort();
  
  console.log(`   上传文件数量: ${uploads.length}`);
  console.log(`   结果文件数量: ${results.length}`);
  
  if (uploads.length > 0) {
    const latest = uploads[uploads.length - 1];
    console.log(`   最新上传: ${latest}`);
    
    // 检查对应的结果文件
    const resultFile = `results/${latest}.json`;
    if (fs.existsSync(resultFile)) {
      const result = JSON.parse(fs.readFileSync(resultFile, 'utf-8'));
      console.log(`   结果文件状态: ✅ 存在`);
      console.log(`   detailedData长度: ${result.detailedData?.length || 0}`);
      console.log(`   处理状态: ${result.status || 'unknown'}`);
    } else {
      console.log(`   结果文件状态: ❌ 不存在`);
    }
  }
  console.log('');
}

// 2. 测试所有相关API端点
function testAPIEndpoints() {
  console.log('2. API端点测试:');
  
  const fileId = 'ff213509-8522-4652-b6e6-ebf806c70df5'; // 从诊断结果获取
  const endpoints = [
    `/api/analytics-enhanced?fileId=${fileId}`,
    `/api/upload-optimized?fileId=${fileId}`,
    `/api/data?fileId=${fileId}&page=1&pageSize=10`
  ];
  
  endpoints.forEach((endpoint, index) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: endpoint,
      method: 'GET'
    };
    
    const req = http.request(options, (res) => {
      console.log(`   ${index + 1}. ${endpoint}`);
      console.log(`      状态码: ${res.statusCode}`);
      
      if (res.statusCode === 200) {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (endpoint.includes('analytics-enhanced')) {
              console.log(`      advertiserAnalysis数量: ${response.advertiserAnalysis?.length || 0}`);
              console.log(`      geoAnalysis数量: ${response.geoAnalysis?.length || 0}`);
            } else if (endpoint.includes('upload-optimized')) {
              console.log(`      文件状态: ${response.status}`);
              console.log(`      文件名: ${response.fileName || 'N/A'}`);
            } else if (endpoint.includes('api/data')) {
              console.log(`      数据行数: ${response.data?.length || 0}`);
              console.log(`      总页数: ${response.pagination?.totalPages || 0}`);
            }
          } catch (e) {
            console.log(`      响应解析错误: ${e.message}`);
          }
          console.log('');
        });
      } else {
        console.log(`      错误响应`);
        console.log('');
      }
    });
    
    req.on('error', (err) => {
      console.log(`   ${index + 1}. ${endpoint}`);
      console.log(`      请求失败: ${err.message}`);
      console.log('');
    });
    
    req.end();
  });
}

// 3. 检查前端可能的问题
function checkFrontendIssues() {
  console.log('3. 前端问题检查:');
  console.log('   可能的问题和解决方案:');
  console.log('');
  console.log('   A. URL参数问题:');
  console.log(`      - 当前应该访问: http://localhost:3000/?fileId=ff213509-8522-4652-b6e6-ebf806c70df5`);
  console.log('      - 检查浏览器地址栏是否包含fileId参数');
  console.log('');
  console.log('   B. 标签页切换问题:');
  console.log('      - 确保点击了"高级分析"标签页');
  console.log('      - activeTab应该设置为"enhanced"');
  console.log('');
  console.log('   C. 浏览器缓存问题:');
  console.log('      - 按 Cmd+Shift+R (Mac) 或 Ctrl+Shift+R (Windows) 硬刷新');
  console.log('      - 或打开开发者工具 -> Network -> 勾选 Disable cache');
  console.log('');
  console.log('   D. JavaScript错误:');
  console.log('      - 按F12打开开发者工具');
  console.log('      - 查看Console标签是否有红色错误信息');
  console.log('      - 查看Source标签是否有断点或错误');
  console.log('');
  console.log('   E. 网络请求问题:');
  console.log('      - 在开发者工具的Network标签中');
  console.log('      - 查找对 /api/analytics-enhanced 的请求');
  console.log('      - 检查请求参数和响应内容');
  console.log('');
  console.log('   F. 组件状态问题:');
  console.log('      - EnhancedAnalytics组件可能未正确接收fileId');
  console.log('      - 检查组件的useEffect是否正确触发');
  console.log('');
}

// 4. 生成测试步骤
function generateTestSteps() {
  console.log('4. 手动测试步骤:');
  console.log('   1. 打开浏览器访问: http://localhost:3000/?fileId=ff213509-8522-4652-b6e6-ebf806c70df5');
  console.log('   2. 点击"高级分析"标签页');
  console.log('   3. 如果没有数据，按F12打开开发者工具');
  console.log('   4. 在Console中输入: localStorage.clear() 然后刷新页面');
  console.log('   5. 如果仍然没有数据，检查Network标签');
  console.log('   6. 查找 analytics-enhanced 请求，点击查看详情');
  console.log('   7. 检查Response是否包含数据');
  console.log('   8. 如果有数据但页面不显示，说明是前端渲染问题');
  console.log('   9. 如果没有数据，说明是API调用问题');
}

// 运行诊断
checkFileStatus();
testAPIEndpoints();
checkFrontendIssues();
generateTestSteps();

console.log('\n=== 诊断完成 ===');