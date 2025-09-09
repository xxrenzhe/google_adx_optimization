#!/usr/bin/env node

const http = require('http');

// 使用最新的fileId
const fileId = 'ff213509-8522-4652-b6e6-ebf806c70df5';

console.log(`Testing enhanced analytics with fileId: ${fileId}\n`);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: `/api/analytics-enhanced?fileId=${fileId}`,
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      const response = JSON.parse(data);
      console.log('✓ API Response successful');
      console.log('\nData summary:');
      console.log(`- Advertiser analysis: ${response.advertiserAnalysis?.length || 0} items`);
      console.log(`- eCPM buckets: ${response.ecmpBuckets?.length || 0} items`);
      console.log(`- Device-browser matrix: ${response.deviceBrowserMatrix?.length || 0} items`);
      console.log(`- Geo analysis: ${response.geoAnalysis?.length || 0} items`);
      console.log(`- Ad unit analysis: ${response.adUnitAnalysis?.length || 0} items`);
      console.log(`- Top combinations: ${response.topCombinations?.length || 0} items`);
      console.log(`- Hourly pattern: ${response.hourlyPattern?.length || 0} items`);
      console.log(`- Viewability analysis: ${response.viewabilityAnalysis?.length || 0} items`);
      console.log(`- Insights: ${response.insights?.length || 0} items`);
      console.log(`- Recommendations: ${response.recommendations?.length || 0} items`);
      
      // 检查是否有数据
      const hasData = response.advertiserAnalysis?.length > 0 || 
                     response.ecmpBuckets?.length > 0 ||
                     response.deviceBrowserMatrix?.length > 0;
      
      if (hasData) {
        console.log('\n✅ Enhanced analytics HAS data');
      } else {
        console.log('\n❌ Enhanced analytics has NO data');
      }
    } else {
      console.log('✗ Error response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

req.end();