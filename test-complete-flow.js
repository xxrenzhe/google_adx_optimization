#!/usr/bin/env node

// Test the complete flow from upload to display
const fs = require('fs');
const path = require('path');

console.log('=== Testing Complete Upload Flow ===\n');

// 1. Check if server is running
console.log('1. Checking if server is running...');
const { execSync } = require('child_process');
try {
  const response = execSync('curl -s -o /dev/null -w "%{http_code}" http://localhost:3000', { timeout: 5000 });
  if (response.toString() === '200') {
    console.log('✓ Server is running');
  } else {
    console.log('✗ Server is not responding properly');
    process.exit(1);
  }
} catch (e) {
  console.log('✗ Server is not running');
  process.exit(1);
}

// 2. Find a test file
console.log('\n2. Looking for test file...');
const testFiles = [
  'Detail_report.csv',
  'Detail_report_35M.csv',
  'test-sample.csv'
];

let testFile = null;
for (const file of testFiles) {
  if (fs.existsSync(file)) {
    testFile = file;
    console.log(`✓ Found test file: ${file}`);
    break;
  }
}

if (!testFile) {
  console.log('✗ No test file found');
  process.exit(1);
}

// 3. Upload the file
console.log('\n3. Uploading file...');
const formData = require('form-data');
const FormData = formData.default || formData;

const form = new FormData();
form.append('file', fs.createReadStream(testFile));

let uploadResponse;
try {
  uploadResponse = execSync(`curl -X POST http://localhost:3000/api/upload-optimized -F "file=@${testFile}" -H "Accept: application/json"`, { encoding: 'utf8' });
  console.log('✓ Upload response received');
} catch (e) {
  console.log('✗ Upload failed:', e.message);
  process.exit(1);
}

const uploadResult = JSON.parse(uploadResponse);
console.log('Upload result:', {
  fileId: uploadResult.fileId,
  message: uploadResult.message,
  error: uploadResult.error
});

if (uploadResult.error) {
  console.log('✗ Upload failed with error');
  process.exit(1);
}

// 4. Poll for results
console.log('\n4. Polling for results...');
let attempts = 0;
const maxAttempts = 30;
let result = null;

while (attempts < maxAttempts) {
  attempts++;
  try {
    const pollResponse = execSync(`curl -s http://localhost:3000/api/result/${uploadResult.fileId}`, { encoding: 'utf8' });
    result = JSON.parse(pollResponse);
    
    console.log(`Attempt ${attempts}: Status = ${result.status}`);
    
    if (result.status === 'completed') {
      console.log('✓ Processing completed');
      break;
    } else if (result.status === 'failed') {
      console.log('✗ Processing failed');
      process.exit(1);
    }
    
    // Wait before next poll
    if (attempts < maxAttempts) {
      execSync('sleep 2');
    }
  } catch (e) {
    console.log(`Attempt ${attempts}: Poll failed - ${e.message}`);
    if (attempts < maxAttempts) {
      execSync('sleep 2');
    }
  }
}

if (!result || result.status !== 'completed') {
  console.log('✗ Did not complete processing');
  process.exit(1);
}

// 5. Check the result structure
console.log('\n5. Checking result structure...');
console.log('Result keys:', Object.keys(result));
console.log('Has result:', !!result.result);
console.log('Has samplePreview:', result.result ? !!result.result.samplePreview : false);

if (result.result && result.result.samplePreview) {
  console.log('Sample preview length:', result.result.samplePreview.length);
  
  if (result.result.samplePreview.length > 0) {
    const sample = result.result.samplePreview[0];
    console.log('First sample keys:', Object.keys(sample));
    console.log('Sample data:', {
      date: sample.date,
      website: sample.website,
      revenue: sample.revenue,
      impressions: sample.impressions
    });
  }
}

// 6. Simulate frontend display logic
console.log('\n6. Simulating frontend conditions...');

// The condition from upload-optimized.tsx
const analysisData = result.result;
const activeFileId = uploadResult.fileId;
const files = [{ id: uploadResult.fileId, status: 'completed' }];

const displayCondition = analysisData && 
  activeFileId && 
  (files.length === 0 || files.some(f => f.id === activeFileId && f.status === 'completed'));

console.log('Display condition check:', {
  hasAnalysisData: !!analysisData,
  hasActiveFileId: !!activeFileId,
  activeFileId: activeFileId,
  filesLength: files.length,
  hasCompletedFile: files.some(f => f.id === activeFileId && f.status === 'completed'),
  shouldDisplay: displayCondition
});

if (displayCondition) {
  console.log('✓ Should display analysis results');
} else {
  console.log('✗ Should NOT display analysis results');
}

console.log('\n=== Test Complete ===');