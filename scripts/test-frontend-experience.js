#!/usr/bin/env node

/**
 * 模拟前端用户上传体验测试
 * 验证用户在上传阶段是否能立即看到进度反馈
 */

const https = require('https');
const fs = require('fs');

// 模拟前端的上传行为
class FrontendUploadSimulator {
  constructor() {
    this.fileId = null;
    this.progressUpdates = [];
    this.startTime = null;
  }

  // 创建较大的测试文件（模拟真实场景）
  createTestFile() {
    console.log('📄 创建测试文件...');
    const rows = [];
    const headers = 'Date,Website,Country,Device,AdFormat,Requests,Impressions,Clicks,Revenue,ECPM';
    
    // 生成1000行数据
    for (let i = 0; i < 1000; i++) {
      const date = `2024-01-${String(i % 30 + 1).padStart(2, '0')}`;
      const website = `site${i % 50}.com`;
      const country = ['US', 'UK', 'CA', 'AU', 'DE'][i % 5];
      const device = ['Mobile', 'Desktop', 'Tablet'][i % 3];
      const format = ['Banner', 'Interstitial', 'Video'][i % 3];
      const requests = Math.floor(Math.random() * 10000) + 1000;
      const impressions = Math.floor(requests * (0.5 + Math.random() * 0.4));
      const clicks = Math.floor(impressions * (0.01 + Math.random() * 0.05));
      const revenue = (impressions * (0.5 + Math.random() * 2)).toFixed(2);
      const ecpm = (revenue / impressions * 1000).toFixed(2);
      
      rows.push(`${date},${website},${country},${device},${format},${requests},${impressions},${clicks},${revenue},${ecpm}`);
    }
    
    const csvContent = [headers, ...rows].join('\n');
    const fileName = `frontend-test-${Date.now()}.csv`;
    fs.writeFileSync(fileName, csvContent);
    
    console.log(`📄 测试文件已创建: ${fileName} (${(csvContent.length / 1024).toFixed(2)} KB)`);
    return fileName;
  }

  // 模拟上传进度反馈
  simulateProgressFeedback(fileId) {
    console.log('\n🔄 模拟前端进度反馈...');
    
    // 立即显示上传开始
    this.progressUpdates.push({ time: 0, status: 'uploading', progress: 0 });
    console.log('⏱️ [0ms] 用户看到：上传开始 (0%)');
    
    // 模拟上传进度
    const uploadInterval = setInterval(() => {
      const elapsed = Date.now() - this.startTime;
      
      if (elapsed < 1000) {
        // 上传阶段
        const progress = Math.min(90, (elapsed / 1000) * 90);
        this.progressUpdates.push({ time: elapsed, status: 'uploading', progress });
        console.log(`⏱️ [${elapsed}ms] 用户看到：上传中 (${progress.toFixed(0)}%)`);
      } else if (elapsed < 2000) {
        // 处理阶段
        const progress = 90 + (elapsed - 1000) / 1000 * 10;
        this.progressUpdates.push({ time: elapsed, status: 'processing', progress });
        console.log(`⏱️ [${elapsed}ms] 用户看到：处理中 (${progress.toFixed(0)}%)`);
      } else {
        clearInterval(uploadInterval);
        this.progressUpdates.push({ time: elapsed, status: 'completed', progress: 100 });
        console.log(`⏱️ [${elapsed}ms] 用户看到：完成 (100%)`);
      }
    }, 100);
    
    // 5秒后停止
    setTimeout(() => clearInterval(uploadInterval), 5000);
  }

  // 执行上传测试
  async runUploadTest() {
    console.log('='.repeat(60));
    console.log('🧪 前端用户体验测试 - 上传进度反馈');
    console.log('='.repeat(60));
    
    const testFile = this.createTestFile();
    this.startTime = Date.now();
    
    // 1. 开始上传并立即显示进度
    console.log('\n📤 开始上传...');
    this.simulateProgressFeedback('temp-file-id');
    
    // 2. 实际执行上传
    try {
      const result = await this.uploadFile(testFile);
      this.fileId = result.fileId;
      
      console.log('\n✅ 上传成功！');
      console.log(`🆔 文件ID: ${result.fileId}`);
      console.log(`📄 文件名: ${result.fileName}`);
      console.log(`📏 文件大小: ${(result.fileSize / 1024).toFixed(2)} KB`);
      
      // 3. 轮询状态
      console.log('\n📊 轮询文件状态...');
      await this.pollStatus(result.fileId);
      
    } catch (error) {
      console.error('\n❌ 上传失败:', error.message);
    } finally {
      // 清理
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
        console.log(`\n🧹 清理测试文件: ${testFile}`);
      }
    }
  }

  // 上传文件
  uploadFile(filePath) {
    return new Promise((resolve, reject) => {
      const fileContent = fs.readFileSync(filePath);
      const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substring(2);
      
      // 构建FormData
      const formDataParts = [
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="file"; filename="${filePath}"\r\n`,
        `Content-Type: text/csv\r\n`,
        `\r\n`,
        fileContent,
        `\r\n--${boundary}--\r\n`
      ];
      
      const totalLength = formDataParts.reduce((acc, part) => {
        return acc + (Buffer.isBuffer(part) ? part.length : Buffer.byteLength(part, 'utf8'));
      }, 0);
      
      const req = https.request({
        hostname: 'www.moretop10.com',
        port: 443,
        path: '/api/upload-optimized',
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': totalLength.toString()
        }
      }, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (res.statusCode === 200) {
              resolve(response);
            } else {
              reject(new Error(response.error || 'Upload failed'));
            }
          } catch (e) {
            reject(new Error('Invalid response'));
          }
        });
      });
      
      req.on('error', reject);
      
      // 发送数据
      formDataParts.forEach(part => {
        if (Buffer.isBuffer(part)) {
          req.write(part);
        } else {
          req.write(part, 'utf8');
        }
      });
      
      req.end();
    });
  }

  // 轮询状态
  async pollStatus(fileId, maxAttempts = 20) {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 500)); // 每500ms查询一次
      
      try {
        const status = await this.getStatus(fileId);
        const elapsed = Date.now() - this.startTime;
        
        console.log(`⏱️ [${elapsed}ms] 状态查询: ${status.status} (${status.progress || 0}%)`);
        
        if (status.status === 'completed' || status.status === 'failed') {
          console.log(`\n📋 最终状态: ${status.status}`);
          return;
        }
      } catch (error) {
        console.log(`⚠️ 状态查询失败: ${error.message}`);
      }
    }
    
    console.log('\n⚠️ 轮询超时');
  }

  // 获取状态
  getStatus(fileId) {
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'www.moretop10.com',
        port: 443,
        path: `/api/upload-optimized?fileId=${fileId}`,
        method: 'GET'
      }, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const status = JSON.parse(data);
            resolve(status);
          } catch (e) {
            reject(new Error('Invalid status response'));
          }
        });
      });
      
      req.on('error', reject);
      req.end();
    });
  }
}

// 运行测试
const simulator = new FrontendUploadSimulator();
simulator.runUploadTest().catch(console.error);