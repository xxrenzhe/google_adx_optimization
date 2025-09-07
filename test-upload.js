#!/usr/bin/env node

// Test script for uploading large CSV files
const fs = require('fs');
const path = require('path');
const http = require('http');

const SERVER_URL = 'http://localhost:3000';
const CSV_FILE_PATH = path.join(__dirname, 'files', 'Detail_report_35M.csv');

// Create a readable stream for the file
const fileStream = fs.createReadStream(CSV_FILE_PATH);
const fileSize = fs.statSync(CSV_FILE_PATH).size;

console.log(`🚀 Testing upload of ${CSV_FILE_PATH}`);
console.log(`📊 File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

// Prepare the request
const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substring(2);
let uploadedBytes = 0;

const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/upload',
    method: 'POST',
    headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Cookie': 'session=test-session' // Add session cookie
    }
}, (res) => {
    let data = '';
    
    res.on('data', chunk => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log('\n✅ Upload completed!');
        console.log(`📋 Response: ${data}`);
        
        try {
            const result = JSON.parse(data);
            if (result.sessionId) {
                console.log(`🆔 Session ID: ${result.sessionId}`);
                console.log(`📊 Records processed: ${result.recordCount || 'unknown'}`);
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
const formHeaders = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="Detail_report_35M.csv"',
    'Content-Type: text/csv',
    '',
    '',
    `--${boundary}--`
].join('\r\n');

// Write headers
req.write([
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="Detail_report_35M.csv"',
    'Content-Type: text/csv',
    '',
].join('\r\n'));

// Pipe the file
fileStream.on('data', (chunk) => {
    uploadedBytes += chunk.length;
    const progress = (uploadedBytes / fileSize * 100).toFixed(1);
    process.stdout.write(`\r📤 Uploading: ${progress}% (${(uploadedBytes / 1024 / 1024).toFixed(1)}MB)`);
});

fileStream.on('end', () => {
    req.write('\r\n');
    req.write(`--${boundary}--\r\n`);
    req.end();
});

fileStream.pipe(req, { end: false });