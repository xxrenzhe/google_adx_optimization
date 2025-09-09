const fs = require('fs');
const path = require('path');

// 修复 predictive-analytics/route.ts 的语法错误
let content = fs.readFileSync(path.join(__dirname, '../app/api/predictive-analytics/route.ts'), 'utf8');

// 修复 += 操作符的错误
content = content.replace(/\.revenue as number \+=/g, '.revenue +=');
content = content.replace(/\.impressions as number \+=/g, '.impressions +=');
content = content.replace(/\.ecpm as number \+=/g, '.ecpm +=');
content = content.replace(/day\.revenue as number/g, 'day.revenue');
content = content.replace(/day\.impressions as number/g, 'day.impressions');
content = content.replace(/day\.clicks as number/g, 'day.clicks');
content = content.replace(/day\.requests as number/g, 'day.requests');
content = content.replace(/day\.ecpm as number/g, 'day.ecpm');
content = content.replace(/day\.country as string/g, 'day.country');
content = content.replace(/day\.advertiser as string/g, 'day.advertiser');
content = content.replace(/day\.domain as string/g, 'day.domain');
content = content.replace(/stat\.revenue as number/g, 'stat.revenue');
content = content.replace(/stat\.impressions as number/g, 'stat.impressions');
content = content.replace(/stat\.ecpm as number/g, 'stat.ecpm');
content = content.replace(/result\.samplePreview as any/g, 'result.samplePreview');
content = content.replace(/\.samplePreview as any/g, '.samplePreview');

fs.writeFileSync(path.join(__dirname, '../app/api/predictive-analytics/route.ts'), content);

console.log('Fixed predictive-analytics/route.ts syntax errors');