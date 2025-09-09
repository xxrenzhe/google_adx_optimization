#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { processFileOptimized } = require('../lib/file-processor');

const RESULTS_DIR = path.join(process.cwd(), 'results');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

async function regenerateResults() {
  try {
    // 获取所有结果文件
    const resultFiles = await fs.readdir(RESULTS_DIR);
    const jsonFiles = resultFiles.filter(file => file.endsWith('.json'));
    
    console.log(`Found ${jsonFiles.length} result files to regenerate...\n`);
    
    for (const jsonFile of jsonFiles) {
      const fileId = jsonFile.replace('.json', '');
      const uploadFile = path.join(UPLOADS_DIR, fileId);
      const resultFile = path.join(RESULTS_DIR, jsonFile);
      const statusFile = path.join(RESULTS_DIR, `${fileId}.status`);
      
      // 检查对应的上传文件是否存在
      try {
        await fs.access(uploadFile);
        
        console.log(`Regenerating ${fileId}...`);
        
        // 读取原始文件信息
        const resultData = JSON.parse(await fs.readFile(resultFile, 'utf-8'));
        const fileName = resultData.fileName || fileId;
        
        // 创建新的状态文件
        await fs.writeFile(statusFile, JSON.stringify({
          status: 'processing',
          fileName,
          progress: 0,
          regenerating: true
        }, null, 2));
        
        // 获取文件大小
        const stats = await fs.stat(uploadFile);
        
        // 重新处理文件
        await processFileOptimized(fileId, uploadFile, statusFile, stats.size);
        
        console.log(`✓ Completed ${fileId}`);
        
        // 短暂延迟，避免内存问题
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.log(`✗ Upload file not found for ${fileId}, skipping...`);
        } else {
          console.error(`✗ Error processing ${fileId}:`, error.message);
        }
      }
    }
    
    console.log('\nRegeneration completed!');
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// 运行脚本
if (require.main === module) {
  regenerateResults();
}

module.exports = { regenerateResults };