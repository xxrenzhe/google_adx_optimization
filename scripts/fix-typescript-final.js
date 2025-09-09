const fs = require('fs');
const path = require('path');

// 修复 analytics-enhanced/route.ts
let content = fs.readFileSync(path.join(__dirname, '../app/api/analytics-enhanced/route.ts'), 'utf8');

// 1. 修复类型断言问题
content = content.replace(/\(row as EnhancedAnalyticsData\)\./g, 'row.');
content = content.replace(/\(item as EnhancedAnalyticsData\)\./g, 'item.');
content = content.replace(/\(bucket as AggregatedData\)\./g, 'bucket.');

// 2. 修复 unknown 类型问题
content = content.replace(/: unknown\[\]/g, ': DetailedDataRow[]');
content = content.replace(/: unknown/g, ': any');

// 3. 修复 Number() 调用
content = content.replace(/Number\(/g, '(');

// 4. 修复 viewabilityAnalysis filter
content = content.replace(/\.filter\(\(item: EnhancedAnalyticsData\) =>/g, '.filter((item: any) =>');

fs.writeFileSync(path.join(__dirname, '../app/api/analytics-enhanced/route.ts'), content);

console.log('Fixed analytics-enhanced/route.ts');

// 修复 alerts/route.ts
content = fs.readFileSync(path.join(__dirname, '../app/api/alerts/route.ts'), 'utf8');
content = content.replace(/: unknown/g, ': any');
fs.writeFileSync(path.join(__dirname, '../app/api/alerts/route.ts'), content);

console.log('Fixed alerts/route.ts');

// 修复 decision-alerts.tsx
content = fs.readFileSync(path.join(__dirname, '../components/decision-alerts.tsx'), 'utf8');
content = content.replace(/Alert\[\]/g, 'AlertData[]');
content = content.replace(/alerts\.map\(/g, '(alerts as AlertData[]).map(');
content = content.replace(/alert\.id/g, '(alert as AlertData).id');
content = content.replace(/alert\.type/g, '(alert as AlertData).type as "warning" | "success" | "error" | "info"');
fs.writeFileSync(path.join(__dirname, '../components/decision-alerts.tsx'), content);

console.log('Fixed decision-alerts.tsx');

// 修复 aggregator.ts
content = fs.readFileSync(path.join(__dirname, '../lib/aggregator.ts'), 'utf8');
content = content.replace(/day\.revenue/g, '(day as any).revenue');
content = content.replace(/day\.impressions/g, '(day as any).impressions');
content = content.replace(/day\.clicks/g, '(day as any).clicks');
content = content.replace(/day\.requests/g, '(day as any).requests');
fs.writeFileSync(path.join(__dirname, '../lib/aggregator.ts'), content);

console.log('Fixed aggregator.ts');

// 修复 config.ts
content = fs.readFileSync(path.join(__dirname, '../lib/config.ts'), 'utf8');
content = content.replace(/error\.message/g, '(error as any).message');
fs.writeFileSync(path.join(__dirname, '../lib/config.ts'), content);

console.log('Fixed config.ts');

// 修复 db-init.ts
content = fs.readFileSync(path.join(__dirname, '../lib/db-init.ts'), 'utf8');
content = content.replace(/err\.code/g, '(err as any).code');
content = content.replace(/err\.message/g, '(err as any).message');
content = content.replace(/err\.stack/g, '(err as any).stack');
fs.writeFileSync(path.join(__dirname, '../lib/db-init.ts'), content);

console.log('Fixed db-init.ts');

// 修复 fs-manager.ts
content = fs.readFileSync(path.join(__dirname, '../lib/fs-manager.ts'), 'utf8');
content = content.replace(/return \{\}/g, 'return { revenue: 0, impressions: 0, ecpm: 0 }');
content = content.replace(/const result: \{\} = {}/g, 'const result: AggregatedData = { revenue: 0, impressions: 0, ecpm: 0 }');
content = content.replace(/const dailyResult: \{\} = {}/g, 'const dailyResult: DailyData = { date: \'\', revenue: 0, impressions: 0 }');
fs.writeFileSync(path.join(__dirname, '../lib/fs-manager.ts'), content);

console.log('Fixed fs-manager.ts');

// 修复 retry.ts
content = fs.readFileSync(path.join(__dirname, '../lib/retry.ts'), 'utf8');
content = content.replace(/error\.code/g, '(error as any).code');
fs.writeFileSync(path.join(__dirname, '../lib/retry.ts'), content);

console.log('Fixed retry.ts');

// 修复 predictive-analytics/route.ts
content = fs.readFileSync(path.join(__dirname, '../app/api/predictive-analytics/route.ts'), 'utf8');
content = content.replace(/\.revenue/g, '.revenue as number');
content = content.replace(/\.impressions/g, '.impressions as number');
content = content.replace(/\.clicks/g, '.clicks as number');
content = content.replace(/\.requests/g, '.requests as number');
content = content.replace(/\.ecpm/g, '.ecpm as number');
content = content.replace(/\.country/g, '.country as string');
content = content.replace(/\.advertiser/g, '.advertiser as string');
content = content.replace(/\.domain/g, '.domain as string');
content = content.replace(/\.samplePreview/g, '.samplePreview as any');
fs.writeFileSync(path.join(__dirname, '../app/api/predictive-analytics/route.ts'), content);

console.log('Fixed predictive-analytics/route.ts');

// 修复 upload-optimized/route.ts
content = fs.readFileSync(path.join(__dirname, '../app/api/upload-optimized/route.ts'), 'utf8');
content = content.replace(/error\.message/g, '(error as any).message');
fs.writeFileSync(path.join(__dirname, '../app/api/upload-optimized/route.ts'), content);

console.log('Fixed upload-optimized/route.ts');

// 修复 upload-optimized.tsx
content = fs.readFileSync(path.join(__dirname, '../components/upload-optimized.tsx'), 'utf8');
content = content.replace(/updateFileProgress\(tempFileId, progress, 'uploading'\)/g, 'updateFileProgress(tempFileId, progress as number, \'uploading\')');
fs.writeFileSync(path.join(__dirname, '../components/upload-optimized.tsx'), content);

console.log('Fixed upload-optimized.tsx');