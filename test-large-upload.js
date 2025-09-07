#!/usr/bin/env node

// Test script for uploading the full 35M CSV file
const fs = require('fs');
const path = require('path');
const http = require('http');

const SERVER_URL = 'http://localhost:3000';
const CSV_FILE_PATH = path.join(__dirname, 'files', 'Detail_report_35M.csv');

// Check if file exists
if (!fs.existsSync(CSV_FILE_PATH)) {
  console.error('❌ File not found:', CSV_FILE_PATH);
  process.exit(1);
}

const fileStats = fs.statSync(CSV_FILE_PATH);
console.log('🚀 Testing upload of full 35M CSV file');
console.log(`📊 File: ${CSV_FILE_PATH}`);
console.log(`📊 Size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);
console.log(`⏳ Starting upload...\n`);

// Create a readable stream for the file
const fileStream = fs.createReadStream(CSV_FILE_PATH);

// Prepare the request
const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substring(2);
let uploadedBytes = 0;
let startTime = Date.now();

const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/upload-optimized',
    method: 'POST',
    headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Cookie': 'session=test-session'
    }
}, (res) => {
    let data = '';
    
    res.on('data', chunk => {
        data += chunk;
    });
    
    res.on('end', () => {
        const duration = (Date.now() - startTime) / 1000;
        console.log('\n✅ Upload completed!');
        console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
        console.log(`📋 Response: ${data}`);
        
        try {
            const result = JSON.parse(data);
            if (result.sessionId) {
                console.log(`\n🆔 Session ID: ${result.sessionId}`);
                console.log(`📊 Records processed: ${result.recordCount?.toLocaleString() || 'unknown'}`);
                console.log(`⚡ Processing rate: ${((result.recordCount || 0) / duration).toFixed(0)} records/second`);
                
                // Save session info for further testing
                fs.writeFileSync('last-session.json', JSON.stringify({
                    sessionId: result.sessionId,
                    filename: result.filename,
                    recordCount: result.recordCount,
                    timestamp: new Date().toISOString()
                }, null, 2));
                console.log('\n💾 Session info saved to last-session.json');
            }
        } catch (e) {
            console.log('❌ Failed to parse response');
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Upload failed:', error.message);
});

// Build the multipart form data
req.write([
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="Detail_report_35M.csv"',
    'Content-Type: text/csv',
    '',
    '',
].join('\r\n'));

// Pipe the file with progress tracking
fileStream.on('data', (chunk) => {
    uploadedBytes += chunk.length;
    const progress = (uploadedBytes / fileStats.size * 100).toFixed(1);
    const speed = (uploadedBytes / 1024 / 1024 / ((Date.now() - startTime) / 1000)).toFixed(2);
    process.stdout.write(`\r📤 Uploading: ${progress}% (${(uploadedBytes / 1024 / 1024).toFixed(1)}MB) ${speed}MB/s`);
});

fileStream.on('end', () => {
    req.write('\r\n');
    req.write(`--${boundary}--\r\n`);
    req.end();
});

fileStream.pipe(req, { end: false });