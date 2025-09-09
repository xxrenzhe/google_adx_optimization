// 测试直接访问没有fileId的enhanced analytics页面
console.log('Opening test page...');

// 创建一个测试HTML文件来模拟浏览器访问
const fs = require('fs');

const testHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Enhanced Analytics</title>
</head>
<body>
    <h1>Testing Enhanced Analytics without fileId</h1>
    <script>
        // Test 1: Direct API call without fileId
        fetch('/api/analytics-enhanced')
            .then(response => response.json())
            .then(data => {
                console.log('API Response (no fileId):', data);
            })
            .catch(error => {
                console.error('API Error:', error);
            });
        
        // Test 2: API call with valid fileId
        fetch('/api/analytics-enhanced?fileId=025303a7-93d6-4a7b-aad1-3e945c27493a')
            .then(response => response.json())
            .then(data => {
                console.log('API Response (with fileId):', data);
            })
            .catch(error => {
                console.error('API Error:', error);
            });
    </script>
</body>
</html>
`;

fs.writeFileSync('test-enhanced.html', testHtml);
console.log('Created test-enhanced.html');
console.log('Open this file in a browser while the dev server is running to see console output');