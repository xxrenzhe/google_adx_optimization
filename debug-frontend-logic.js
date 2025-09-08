// 模拟前端的条件判断逻辑
const smallFileData = JSON.parse(require('fs').readFileSync('./results/2297a0f0-2a62-437c-9d7a-b758fedee66d.json'));
const largeFileData = JSON.parse(require('fs').readFileSync('./results/afd49058-9847-43b4-9757-853d692b7291.json'));

// 模拟前端的状态
const simulateFrontendLogic = (analysisData, activeFileId, files) => {
  console.log('\n=== 模拟前端逻辑 ===');
  console.log('analysisData存在:', !!analysisData);
  console.log('activeFileId存在:', !!activeFileId);
  console.log('files数组长度:', files.length);
  console.log('files为空或当前文件在files中且已完成:', files.length === 0 || files.some(f => f.id === activeFileId && f.status === 'completed'));
  
  const shouldShow = analysisData && activeFileId && (files.length === 0 || files.some(f => f.id === activeFileId && f.status === 'completed'));
  console.log('应该显示分析结果:', shouldShow);
  
  if (shouldShow) {
    console.log('\n样本数据:');
    const sampleData = analysisData.samplePreview || analysisData.sampleData || [];
    console.log('样本数据长度:', sampleData.length);
    console.log('前5行数据:', sampleData.slice(0, 5).map(row => ({
      date: row.date,
      website: row.website,
      country: row.country,
      revenue: row.revenue
    })));
    
    console.log('\n聚合数据:');
    console.log('网站数量:', analysisData.topWebsites?.length || 0);
    console.log('国家数量:', analysisData.topCountries?.length || 0);
    console.log('总收入:', analysisData.summary?.totalRevenue || 0);
  }
};

// 测试小文件
console.log('=== 测试小文件 ===');
simulateFrontendLogic(smallFileData, '2297a0f0-2a62-437c-9d7a-b758fedee66d', []);

// 测试大文件
console.log('\n=== 测试大文件 ===');
simulateFrontendLogic(largeFileData, 'afd49058-9847-43b4-9757-853d692b7291', []);