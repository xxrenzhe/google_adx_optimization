import { NextRequest, NextResponse } from 'next/server';
import { readdir, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { CONFIG } from '@/lib/config';

const RESULTS_DIR = CONFIG.DIRECTORIES.RESULTS_DIR;
const UPLOAD_DIR = CONFIG.DIRECTORIES.UPLOAD_DIR;

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

// 紧急清理：删除最旧的文件直到低于阈值
async function emergencyCleanup(): Promise<{ cleanedFiles: number; freedSpace: number }> {
  let cleanedFiles = 0;
  let freedSpace = 0;
  
  try {
    // 获取所有文件及其修改时间
    const allFiles: Array<{ path: string; mtime: number; size: number }> = [];
    
    // 收集results目录文件
    try {
      const resultFiles = await readdir(RESULTS_DIR);
      for (const file of resultFiles) {
        if (file.endsWith('.json') || file.endsWith('.status')) {
          const filePath = join(RESULTS_DIR, file);
          const fileStat = await stat(filePath);
          allFiles.push({
            path: filePath,
            mtime: fileStat.mtime.getTime(),
            size: fileStat.size
          });
        }
      }
    } catch (error) {
      console.error('Error reading results directory:', error);
    }
    
    // 收集uploads目录文件
    try {
      const uploadFiles = await readdir(UPLOAD_DIR);
      for (const file of uploadFiles) {
        const filePath = join(UPLOAD_DIR, file);
        const fileStat = await stat(filePath);
        allFiles.push({
          path: filePath,
          mtime: fileStat.mtime.getTime(),
          size: fileStat.size
        });
      }
    } catch (error) {
      console.error('Error reading uploads directory:', error);
    }
    
    // 按修改时间排序（最旧的在前）
    allFiles.sort((a, b) => a.mtime - b.mtime);
    
    // 计算当前总大小
    const currentTotalSize = allFiles.reduce((sum, file) => sum + file.size, 0);
    
    // 删除文件直到低于阈值
    let remainingSize = currentTotalSize;
    for (const file of allFiles) {
      if (remainingSize <= CONFIG.DATA_RETENTION.EMERGENCY_CLEANUP_THRESHOLD) {
        break;
      }
      
      try {
        await unlink(file.path);
        cleanedFiles++;
        freedSpace += file.size;
        remainingSize -= file.size;
        
        // 如果是JSON文件，删除对应的status文件
        if (file.path.endsWith('.json')) {
          const statusPath = file.path.replace('.json', '.status');
          try {
            await unlink(statusPath);
          } catch (e) {
            // status文件不存在，忽略
          }
        }
      } catch (error) {
        console.error(`Error deleting file ${file.path}:`, error);
      }
    }
  } catch (error) {
    console.error('Emergency cleanup error:', error);
  }
  
  return { cleanedFiles, freedSpace };
}

export async function GET() {
  try {
    // 获取当前存储使用情况
    const resultsSize = await getDirSize(RESULTS_DIR);
    const uploadsSize = await getDirSize(UPLOAD_DIR);
    const totalSize = resultsSize + uploadsSize;
    
    const response: any = {
      success: true,
      storageUsage: {
        results: `${(resultsSize / 1024 / 1024).toFixed(2)} MB`,
        uploads: `${(uploadsSize / 1024 / 1024).toFixed(2)} MB`,
        total: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
        totalBytes: totalSize
      },
      threshold: `${(CONFIG.DATA_RETENTION.EMERGENCY_CLEANUP_THRESHOLD / 1024 / 1024).toFixed(2)} MB`,
      emergencyCleanup: false
    };
    
    // 检查是否需要紧急清理
    if (totalSize > CONFIG.DATA_RETENTION.EMERGENCY_CLEANUP_THRESHOLD) {
      console.log(`Emergency cleanup triggered: ${(totalSize / 1024 / 1024).toFixed(2)}MB used, threshold is ${(CONFIG.DATA_RETENTION.EMERGENCY_CLEANUP_THRESHOLD / 1024 / 1024).toFixed(2)}MB`);
      
      const cleanupResult = await emergencyCleanup();
      
      // 获取清理后的存储使用情况
      const newResultsSize = await getDirSize(RESULTS_DIR);
      const newUploadsSize = await getDirSize(UPLOAD_DIR);
      const newTotalSize = newResultsSize + newUploadsSize;
      
      response.emergencyCleanup = true;
      response.cleanupResult = {
        cleanedFiles: cleanupResult.cleanedFiles,
        freedSpace: `${(cleanupResult.freedSpace / 1024 / 1024).toFixed(2)} MB`,
        newTotal: `${(newTotalSize / 1024 / 1024).toFixed(2)} MB`
      };
      response.storageUsageAfterCleanup = {
        results: `${(newResultsSize / 1024 / 1024).toFixed(2)} MB`,
        uploads: `${(newUploadsSize / 1024 / 1024).toFixed(2)} MB`,
        total: `${(newTotalSize / 1024 / 1024).toFixed(2)} MB`,
        totalBytes: newTotalSize
      };
    }
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Storage monitor error:', error);
    return NextResponse.json(
      { error: '存储监控失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET();
}