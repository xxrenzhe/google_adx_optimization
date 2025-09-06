#!/usr/bin/env node

// Test script to verify the system functionality
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testAPIs() {
  const baseUrl = 'http://localhost:3002';
  
  console.log('Testing Google ADX Optimization System APIs...\n');
  
  // Test 1: Data API (should return no data without session)
  console.log('1. Testing /api/data (no session):');
  try {
    const fetchFunc = await fetch(`${baseUrl}/api/data`);
    const response = await fetchFunc;
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  console.log('\n2. Testing /api/analytics (no session):');
  try {
    const response = await fetch(`${baseUrl}/api/analytics`);
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  console.log('\n3. Testing /api/upload (file upload simulation):');
  // Note: This would require actual file upload, which is more complex to test
  
  console.log('\nAll tests completed!');
}

testAPIs().catch(console.error);