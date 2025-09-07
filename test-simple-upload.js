#!/usr/bin/env node

// Simple curl-based test for upload
const { exec } = require('child_process');

const CSV_FILE_PATH = './files/test_sample.csv';

console.log('🚀 Testing upload with sample file...');

const curlCommand = `curl -X POST \
  http://localhost:3000/api/upload \
  -H 'Cookie: session=test-session' \
  -F 'file=@${CSV_FILE_PATH}' \
  -v`;

exec(curlCommand, (error, stdout, stderr) => {
    if (error) {
        console.error('❌ Upload failed:', error);
        return;
    }
    
    console.log('✅ Upload response:');
    console.log(stdout);
    
    if (stderr) {
        console.log('\n📋 Debug info:');
        console.log(stderr);
    }
});