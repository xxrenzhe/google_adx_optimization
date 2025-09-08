// 在浏览器控制台运行此代码来测试API

async function testAPIs() {
  console.log('=== 测试没有fileId时的API响应 ===');
  
  const apis = [
    '/api/analytics',
    '/api/analytics-enhanced',
    '/api/alerts',
    '/api/predictive-analytics',
    '/api/automation-engine'
  ];
  
  for (const api of apis) {
    try {
      const response = await fetch(api);
      const data = await response.json();
      
      console.log(`\n${api}:`);
      console.log(`Status: ${response.status}`);
      console.log(`Has error: ${!!data.error}`);
      
      if (data.summary) {
        console.log(`Summary totalRevenue: ${data.summary.totalRevenue || 0}`);
      }
      if (data.insights) {
        console.log(`Insights count: ${data.insights.length}`);
      }
      if (data.alerts) {
        console.log(`Alerts count: ${data.alerts.length}`);
      }
      if (data.predictions) {
        console.log(`Predictions count: ${data.predictions.length}`);
      }
    } catch (error) {
      console.log(`\n${api}: Error - ${error.message}`);
    }
  }
}

// 运行测试
testAPIs();