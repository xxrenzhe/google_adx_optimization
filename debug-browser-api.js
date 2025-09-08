// Test script to check if the API is accessible from browser context
const testFileId = '7c532d96-f2d5-4ccb-ace2-81070b03721d';

// Test without port (should work with current dev server)
fetch(`/api/result/${testFileId}`)
  .then(response => response.json())
  .then(data => {
    console.log('=== API Response ===');
    console.log('Status:', data.status);
    console.log('Has result:', !!data.result);
    console.log('SamplePreview length:', data.result?.samplePreview?.length);
    console.log('First sample row:', data.result?.samplePreview?.[0]);
  })
  .catch(error => {
    console.error('Error:', error);
  });