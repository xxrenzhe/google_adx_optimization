// Test script to check the result API
const fileId = '0b6e4165-d6f0-41ca-911e-d5e574c2d370';

fetch(`http://localhost:3000/api/result/${fileId}`)
  .then(response => response.json())
  .then(data => {
    console.log('API Response:', data);
    console.log('Status:', data.status);
    console.log('Sample data length:', data.result?.sampleData?.length);
    if (data.result?.sampleData?.length > 0) {
      console.log('First sample row:', data.result.sampleData[0]);
    }
  })
  .catch(error => {
    console.error('Error:', error);
  });