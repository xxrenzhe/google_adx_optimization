#!/usr/bin/env node

// Test script to verify the system functionality
import('node-fetch').then(({default: fetch}) => {
  
async function testAPIs() {
  const baseUrl = 'http://localhost:3002';
  
  console.log('Testing Google ADX Optimization System APIs...\n');
  
  // Test 1: Data API (should return no data without session)
  console.log('1. Testing /api/data (no session):');
  try {
    const response = await fetch(`${baseUrl}/api/data`);
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
  
  console.log('\nAll tests completed!');
}

testAPIs().catch(console.error);

});