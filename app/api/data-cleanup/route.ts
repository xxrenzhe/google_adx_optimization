import { NextRequest, NextResponse } from 'next/server';
import { readdir, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { CONFIG } from '@/lib/config';

// 获取目录大小
async function getDirSize(dir: string): Promise<number> {
  let totalSize = 0;
  try {
    const files = await readdir(dir);
    for (const file of files) {
      const filePath = join(dir, file);
      const fileStat = await stat(filePath);
      totalSize += fileStat.size;
    }
  } catch (error) {
    // 目录不存在，返回0
  }
  return totalSize;
}

const RESULTS_DIR = CONFIG.DIRECTORIES.RESULTS_DIR;
const UPLOAD_DIR = CONFIG.DIRECTORIES.UPLOAD_DIR;

export async function GET() {
  try {
    const now = Date.now();
    let cutoffTime = now - CONFIG.DATA_RETENTION.RESULT_RETENTION_MS;
    let cleanedCount = 0;
    let totalSize = 0;
    
    // 检查当前存储使用情况
    const currentResultsSize = await getDirSize(RESULTS_DIR);
    const currentUploadsSize = await getDirSize(UPLOAD_DIR);
    const currentTotalSize = currentResultsSize + currentUploadsSize;
    
    // 如果超过紧急阈值，触发更激进的清理
    let emergencyMode = false;
    if (currentTotalSize > CONFIG.DATA_RETENTION.EMERGENCY_CLEANUP_THRESHOLD) {
      console.log(`Emergency mode: ${(currentTotalSize / 1024 / 1024).toFixed(2)}MB used`);
      emergencyMode = true;
      // 在紧急模式下，保留时间减少到1小时
      cutoffTime = now - (1 * 60 * 60 * 1000);
    }

    // 清理results目录
    try {
      const resultFiles = await readdir(RESULTS_DIR);
      
      for (const file of resultFiles) {
        if (file.endsWith('.json') || file.endsWith('.status')) {
          const filePath = join(RESULTS_DIR, file);
          const fileStat = await stat(filePath);
          
          if (fileStat.mtime.getTime() < cutoffTime) {
            totalSize += fileStat.size;
            await unlink(filePath);
            cleanedCount++;
            
            // 同时删除对应的status文件（如果存在）
            const baseName = file.replace('.json', '').replace('.status', '');
            const statusFile = join(RESULTS_DIR, `${baseName}.status`);
            const jsonFile = join(RESULTS_DIR, `${baseName}.json`);
            
            try {
              if (file.endsWith('.json')) {
                await unlink(statusFile);
              } else {
                await unlink(jsonFile);
              }
            } catch (e) {
              // 文件不存在，忽略
            }
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning results directory:', error);
    }

    // 清理uploads目录
    try {
      const uploadFiles = await readdir(UPLOAD_DIR);
      
      for (const file of uploadFiles) {
        const filePath = join(UPLOAD_DIR, file);
        const fileStat = await stat(filePath);
        
        if (fileStat.mtime.getTime() < cutoffTime) {
          totalSize += fileStat.size;
          await unlink(filePath);
          cleanedCount++;
        }
      }
    } catch (error) {
      console.error('Error cleaning uploads directory:', error);
    }

    // 获取清理后的存储使用情况
    const newResultsSize = await getDirSize(RESULTS_DIR);
    const newUploadsSize = await getDirSize(UPLOAD_DIR);
    const newTotalSize = newResultsSize + newUploadsSize;
    
    return NextResponse.json({
      success: true,
      message: `清理完成${emergencyMode ? ' (紧急模式)' : ''}`,
      cleanedFiles: cleanedCount,
      freedSpace: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
      storageBefore: `${(currentTotalSize / 1024 / 1024).toFixed(2)} MB`,
      storageAfter: `${(newTotalSize / 1024 / 1024).toFixed(2)} MB`,
      emergencyMode,
      retentionHours: emergencyMode ? 1 : CONFIG.DATA_RETENTION.RESULT_RETENTION_MS / (60 * 60 * 1000)
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: '清理失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // 支持通过POST触发清理（用于cron job）
  return GET();
}