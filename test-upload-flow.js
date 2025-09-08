#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Test the upload flow with a large file
async function testUpload() {
  console.log('Testing upload flow...\n');
  
  // Check if we have any recent large file results
  const resultsDir = './results';
  const files = fs.readdirSync(resultsDir);
  
  // Find the most recent large file result
  let latestResult = null;
  let latestTime = 0;
  
  for (const file of files) {
    if (file.endsWith('.json')) {
      const filePath = path.join(resultsDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtimeMs > latestTime && stats.size > 100000) { // Larger than 100KB
        latestTime = stats.mtimeMs;
        latestResult = {
          fileId: file.replace('.json', ''),
          path: filePath,
          size: stats.size,
          mtime: stats.mtime
        };
      }
    }
  }
  
  if (latestResult) {
    console.log('Latest large result:', {
      fileId: latestResult.fileId,
      size: `${(latestResult.size / 1024 / 1024).toFixed(2)}MB`,
      time: latestResult.mtime.toISOString()
    });
    
    // Read the result
    const resultData = JSON.parse(fs.readFileSync(latestResult.path, 'utf8'));
    
    console.log('\nResult structure:', {
      hasSamplePreview: !!resultData.samplePreview,
      samplePreviewLength: resultData.samplePreview ? resultData.samplePreview.length : 0,
      hasSummary: !!resultData.summary,
      summaryKeys: resultData.summary ? Object.keys(resultData.summary) : []
    });
    
    // Check if samplePreview data is valid
    if (resultData.samplePreview && resultData.samplePreview.length > 0) {
      const firstRow = resultData.samplePreview[0];
      console.log('\nFirst sample row keys:', Object.keys(firstRow));
      console.log('First row data:', {
        date: firstRow.date,
        website: firstRow.website,
        revenue: firstRow.revenue,
        impressions: firstRow.impressions
      });
    }
  } else {
    console.log('No large result files found');
  }
}

testUpload().catch(console.error);