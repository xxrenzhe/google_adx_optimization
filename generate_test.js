const fs = require('fs');
const path = require('path');

// 生成大测试CSV文件（100万行）
function generateLargeTestFile() {
  const filePath = path.join(__dirname, 'files', 'test_large_1M.csv');
  const writeStream = fs.createWriteStream(filePath);
  
  // 写入CSV头
  writeStream.write('网站,国家/地区,广告资源格式,广告单元（所有级别）,广告客户（已分类）,广告客户网域,设备,浏览器,日期,Ad Exchange 请求总数,Ad Exchange 展示次数,Ad Exchange 点击次数,Ad Exchange 点击率,Ad Exchange 平均 eCPM,Ad Exchange 收入,Ad Exchange Active View可见展示次数,Ad Exchange Active View可见展示次数百分比,Ad Exchange Active View可衡量展示次数\n');
  
  // 生成100万行测试数据
  const websites = ['example.com', 'testsite.com', 'demo.com', 'sample.com'];
  const countries = ['美国', '中国', '日本', '韩国', '德国'];
  const adFormats = ['展示广告', '插页式广告', '原生广告', '视频广告'];
  const devices = ['移动设备', '桌面设备', '平板电脑'];
  const browsers = ['Chrome', 'Safari', 'Firefox', 'Edge'];
  
  console.log('开始生成100万行测试数据...');
  
  for (let i = 0; i < 1000000; i++) {
    const website = websites[Math.floor(Math.random() * websites.length)];
    const country = countries[Math.floor(Math.random() * countries.length)];
    const adFormat = adFormats[Math.floor(Math.random() * adFormats.length)];
    const device = devices[Math.floor(Math.random() * devices.length)];
    const browser = browsers[Math.floor(Math.random() * browsers.length)];
    const date = new Date(2023, 5, Math.floor(Math.random() * 30) + 1).toISOString().split('T')[0];
    
    const requests = Math.floor(Math.random() * 10000);
    const impressions = Math.floor(requests * (0.5 + Math.random() * 0.4));
    const clicks = Math.floor(impressions * (0.001 + Math.random() * 0.05));
    const ctr = clicks / impressions;
    const ecpm = 0.5 + Math.random() * 5;
    const revenue = impressions * ecpm / 1000;
    const viewableImpressions = Math.floor(impressions * (0.6 + Math.random() * 0.3));
    const viewabilityRate = viewableImpressions / impressions;
    const measurableImpressions = Math.floor(impressions * (0.8 + Math.random() * 0.19));
    
    const row = `${website},${country},${adFormat},"Ad Exchange Display,ADX-Test",Alphabet,Web caches and other,${device},${browser},${date},${requests},${impressions},${clicks},${ctr.toFixed(4)},${ecpm.toFixed(6)},${revenue.toFixed(6)},${viewableImpressions},${viewabilityRate.toFixed(4)},${measurableImpressions}\n`;
    
    writeStream.write(row);
    
    if (i % 100000 === 0) {
      console.log(`已生成 ${i} 行`);
    }
  }
  
  writeStream.end();
  console.log('100万行测试数据生成完成！');
}

// 生成中等大小测试文件（21万行，使用真实数据格式）
function generateMediumTestFile() {
  const sourceFile = path.join(__dirname, 'files', 'Detail_report_35M.csv');
  const destFile = path.join(__dirname, 'files', 'test_medium_210K.csv');
  
  if (fs.existsSync(sourceFile)) {
    console.log('使用真实数据文件生成测试文件...');
    fs.copyFileSync(sourceFile, destFile);
    console.log('测试文件已生成:', destFile);
  } else {
    console.log('源文件不存在，请先上传Detail_report_35M.csv');
  }
}

// 执行生成
if (process.argv[2] === 'large') {
  generateLargeTestFile();
} else if (process.argv[2] === 'medium') {
  generateMediumTestFile();
} else {
  console.log('请指定生成大小: node generate_test.js [large|medium]');
}