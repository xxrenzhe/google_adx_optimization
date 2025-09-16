#!/usr/bin/env node

/**
 * 使用35MB真实数据文件测试上传进度反馈
 * 验证用户在上传大文件时的体验
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// 模拟前端上传大文件的体验
class LargeFileUploadTest {
  constructor() {
    this.fileId = null;
    this.startTime = null;
    this.uploadStartTime = null;
  }

  // 执行上传测试
  async runTest() {
    console.log('='.repeat(60));
    console.log('🧪 35MB真实数据文件上传测试');
    console.log('='.repeat(60));
    
    const filePath = 'files/Detail_report_35M.csv';
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ 测试文件不存在:', filePath);
      return;
    }
    
    const stats = fs.statSync(filePath);
    console.log(`📄 测试文件: ${filePath}`);
    console.log(`📏 文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📊 文件行数: ${this.countLines(filePath)}`);
    
    this.startTime = Date.now();
    
    // 1. 模拟用户点击上传
    console.log('\n📤 用户点击上传按钮...');
    console.log('⏱️ [0ms] 用户界面：选择文件完成，点击上传');
    
    // 2. 开始上传
    console.log('\n🔄 开始上传大文件...');
    try {
      const result = await this.uploadLargeFile(filePath);
      this.fileId = result.fileId;
      
      const uploadTime = Date.now() - this.startTime;
      console.log(`\n✅ 上传成功！耗时: ${uploadTime}ms`);
      console.log(`🆔 文件ID: ${result.fileId}`);
      console.log(`📄 文件名: ${result.fileName}`);
      console.log(`📏 文件大小: ${(result.fileSize / 1024 / 1024).toFixed(2)} MB`);
      
      // 3. 立即查询状态（模拟前端实时反馈）
      console.log('\n📊 立即查询处理状态...');
      await this.monitorProcessingStatus(result.fileId);
      
    } catch (error) {
      console.error('\n❌ 上传失败:', error.message);
    }
  }

  // 上传大文件
  uploadLargeFile(filePath) {
    return new Promise((resolve, reject) => {
      const fileContent = fs.readFileSync(filePath);
      const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substring(2);
      const fileName = path.basename(filePath);
      
      console.log('⏱️ [0ms] 开始上传请求...');
      this.uploadStartTime = Date.now();
      
      // 构建FormData
      const formDataParts = [
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`,
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
            const uploadTime = Date.now() - this.uploadStartTime;
            console.log(`⏱️ [${uploadTime}ms] 收到服务器响应`);
            
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
      
      // 模拟上传进度
      let uploadedBytes = 0;
      const totalBytes = fileContent.length;
      const chunkSize = 64 * 1024; // 64KB chunks
      
      // 发送数据（模拟上传进度）
      for (let i = 0; i < formDataParts.length; i++) {
        const part = formDataParts[i];
        
        if (Buffer.isBuffer(part) && part.length > chunkSize) {
          // 大文件分块发送，模拟进度
          for (let offset = 0; offset < part.length; offset += chunkSize) {
            const chunk = part.slice(offset, Math.min(offset + chunkSize, part.length));
            req.write(chunk);
            uploadedBytes += chunk.length;
            
            const progress = (uploadedBytes / totalBytes) * 100;
            const elapsed = Date.now() - this.uploadStartTime;
            
            if (elapsed > 0 && progress % 10 < 1) {
              console.log(`⏱️ [${elapsed}ms] 上传进度: ${progress.toFixed(1)}%`);
            }
          }
        } else {
          if (Buffer.isBuffer(part)) {
            req.write(part);
            uploadedBytes += part.length;
          } else {
            req.write(part, 'utf8');
          }
        }
      }
      
      req.end();
    });
  }

  // 监控处理状态
  async monitorProcessingStatus(fileId) {
    const startTime = Date.now();
    let lastStatus = null;
    let lastProgress = -1;
    
    console.log('⏱️ 开始轮询处理状态...');
    
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 每秒查询一次
      
      try {
        const status = await this.getStatus(fileId);
        const elapsed = Date.now() - startTime;
        
        // 只在状态变化时显示
        if (status.status !== lastStatus || status.progress !== lastProgress) {
          console.log(`⏱️ [${elapsed}ms] 状态: ${status.status} (${status.progress || 0}%)`);
          lastStatus = status.status;
          lastProgress = status.progress;
        }
        
        if (status.status === 'completed') {
          console.log(`\n✅ 处理完成！总耗时: ${elapsed}ms`);
          
          if (status.results) {
            console.log(`📊 处理结果:`);
            console.log(`   - 总记录数: ${status.results.totalRows || 'N/A'}`);
            console.log(`   - 总收入: ¥${status.results.totalRevenue || 'N/A'}`);
            console.log(`   - 平均eCPM: ¥${status.results.avgEcpm || 'N/A'}`);
          }
          
          return;
        }
        
        if (status.status === 'failed') {
          console.log(`\n❌ 处理失败: ${status.error}`);
          return;
        }
        
        // 5分钟超时
        if (elapsed > 300000) {
          console.log(`\n⚠️ 监控超时（5分钟）`);
          return;
        }
        
      } catch (error) {
        const elapsed = Date.now() - startTime;
        console.log(`⏱️ [${elapsed}ms] 状态查询失败: ${error.message}`);
      }
    }
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

  // 计算文件行数
  countLines(filePath) {
    const data = fs.readFileSync(filePath, 'utf8');
    return data.split('\n').length - 1; // 减去标题行
  }
}

// 运行测试
const test = new LargeFileUploadTest();
test.runTest().catch(console.error);