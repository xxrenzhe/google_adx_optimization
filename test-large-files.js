#!/usr/bin/env node

// Test specifically for large file issues
const fs = require('fs');
const path = require('path');

console.log('=== Testing Large File Issues ===\n');

// Check if we have a processed 35M file result
const resultsDir = './results';
const files = fs.readdirSync(resultsDir);

// Find large result files (likely from 35M CSV)
const largeResults = [];
for (const file of files) {
  if (file.endsWith('.json')) {
    const fileId = file.replace('.json', '');
    const filePath = path.join(resultsDir, file);
    const statusPath = path.join(resultsDir, `${fileId}.status`);
    const stats = fs.statSync(filePath);
    
    let fileName = null;
    let fileSize = 0;
    let processedLines = 0;
    let samplePreviewLength = 0;
    
    // Try to get info from status file first
    if (fs.existsSync(statusPath)) {
      try {
        const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
        fileName = status.fileName;
        fileSize = status.fileSize || 0;
        processedLines = status.processedLines || 0;
      } catch (e) {
        // Ignore status read errors
      }
    }
    
    // If not in status, read from result
    if (!fileName) {
      try {
        const result = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        fileName = result.fileName;
        fileSize = result.fileSize || 0;
        processedLines = result.summary?.totalRows || 0;
        samplePreviewLength = result.samplePreview ? result.samplePreview.length : 0;
      } catch (e) {
        // Ignore read errors
      }
    }
    
    if ((fileName && fileName.includes('35M')) || fileSize > 30000000) {
      largeResults.push({
        fileId,
        path: filePath,
        size: stats.size,
        fileName,
        processedLines,
        samplePreviewLength
      });
    }
  }
}

console.log(`Found ${largeResults.length} large file results:\n`);

for (const result of largeResults) {
  console.log(`File ID: ${result.fileId}`);
  console.log(`Original file: ${result.fileName}`);
  console.log(`Processed lines: ${result.processedLines.toLocaleString()}`);
  console.log(`Result file size: ${(result.size / 1024).toFixed(2)}KB`);
  console.log(`Sample preview rows: ${result.samplePreviewLength}`);
  
  // Check if result can be read by API
  try {
    const response = require('child_process').execSync(`curl -s http://localhost:3000/api/result/${result.fileId}`, { encoding: 'utf8', timeout: 5000 });
    const apiResult = JSON.parse(response);
    
    console.log('API check:', {
      status: apiResult.status,
      hasResult: !!apiResult.result,
      samplePreviewLength: apiResult.result ? (apiResult.result.samplePreview || []).length : 0
    });
    
    // Check the display condition
    const analysisData = apiResult.result;
    const activeFileId = result.fileId;
    const files = [{ id: result.fileId, status: 'completed' }];
    
    const displayCondition = analysisData && 
      activeFileId && 
      (files.length === 0 || files.some(f => f.id === activeFileId && f.status === 'completed'));
    
    console.log('Would display in frontend:', displayCondition);
    
  } catch (e) {
    console.log('API check failed:', e.message);
  }
  
  console.log('---\n');
}

if (largeResults.length === 0) {
  console.log('No large file results found to test');
  
  // Check if there are any 35M files in uploads
  console.log('\nChecking uploads directory...');
  const uploadsDir = './uploads';
  if (fs.existsSync(uploadsDir)) {
    const uploadFiles = fs.readdirSync(uploadsDir);
    const largeUploads = uploadFiles.filter(f => {
      const stats = fs.statSync(path.join(uploadsDir, f));
      return stats.size > 30000000; // Larger than 30MB
    });
    
    console.log(`Found ${largeUploads.length} large upload files:`);
    for (const file of largeUploads) {
      const stats = fs.statSync(path.join(uploadsDir, file));
      console.log(`- ${file}: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
    }
  }
}

console.log('\n=== Test Complete ===');