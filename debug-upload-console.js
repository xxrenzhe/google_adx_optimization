// Debug script to run in browser console
// Copy and paste this into the browser console to debug the issue

console.log('=== Debugging Upload Component ===');

// Check URL parameters
const urlParams = new URLSearchParams(window.location.search);
const fileIdFromUrl = urlParams.get('fileId');
console.log('FileId from URL:', fileIdFromUrl);

// Check if the component state is correct
// We need to access React state, which isn't directly available
// But we can check the API calls

// Test API call
if (fileIdFromUrl) {
  fetch(`/api/result/${fileIdFromUrl}`)
    .then(response => response.json())
    .then(data => {
      console.log('API Response:', data);
      console.log('SamplePreview exists:', !!data.result?.samplePreview);
      console.log('SamplePreview length:', data.result?.samplePreview?.length);
      
      // Check first row structure
      if (data.result?.samplePreview?.length > 0) {
        console.log('First sample row:', data.result.samplePreview[0]);
      }
    })
    .catch(error => console.error('API Error:', error));
} else {
  console.log('No fileId in URL');
}

// Check localStorage
const savedFiles = localStorage.getItem('upload-optimized-files');
console.log('Saved files in localStorage:', savedFiles);

const activeFileFromStorage = localStorage.getItem('upload-optimized-active-file');
console.log('Active file from localStorage:', activeFileFromStorage);