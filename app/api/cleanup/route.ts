import { NextRequest, NextResponse } from 'next/server';
import { readdir, unlink, readFile } from 'fs/promises';
import { join } from 'path';

const RESULTS_DIR = './results';
const UPLOAD_DIR = './uploads';

// 清理超过24小时的文件
const CLEANUP_HOURS = 24;

export async function GET() {
  try {
    const now = Date.now();
    const maxAge = CLEANUP_HOURS * 60 * 60 * 1000;
    
    // 获取所有结果文件
    const resultFiles = await readdir(RESULTS_DIR);
    const uploadFiles = await readdir(UPLOAD_DIR);
    
    let cleanedCount = 0;
    let totalSize = 0;
    
    // 清理过期的结果文件
    for (const file of resultFiles) {
      const filePath = join(RESULTS_DIR, file);
      const stats = await import('fs').then(fs => fs.promises.stat(filePath));
      
      if (now - stats.mtime.getTime() > maxAge) {
        const size = stats.size;
        await unlink(filePath);
        cleanedCount++;
        totalSize += size;
        
        // 如果是.status文件，同时清理对应的上传文件
        if (file.endsWith('.status')) {
          const fileId = file.replace('.status', '');
          const uploadFile = uploadFiles.find(f => f.startsWith(fileId));
          if (uploadFile) {
            try {
              await unlink(join(UPLOAD_DIR, uploadFile));
            } catch (e) {
              console.warn(`Failed to delete upload file: ${uploadFile}`);
            }
          }
        }
      }
    }
    
    // 获取当前处理中的任务
    const processingFiles = resultFiles
      .filter(f => f.endsWith('.status'))
      .map(f => f.replace('.status', ''));
    
    const processingStatus = [];
    for (const fileId of processingFiles) {
      try {
        const statusPath = join(RESULTS_DIR, `${fileId}.status`);
        const statusData = await readFile(statusPath, 'utf-8');
        const status = JSON.parse(statusData);
        processingStatus.push({
          fileId,
          status: status.status,
          progress: status.progress || 0,
          fileName: status.fileName,
          uploadTime: status.uploadTime
        });
      } catch (e) {
        // 忽略错误
      }
    }
    
    return NextResponse.json({
      cleaned: {
        files: cleanedCount,
        size: totalSize
      },
      processing: processingStatus,
      cleanupHours: CLEANUP_HOURS
    });
    
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: '清理失败' },
      { status: 500 }
    );
  }
}

// 手动清理特定文件
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    
    if (!fileId) {
      return NextResponse.json(
        { error: '缺少fileId参数' },
        { status: 400 }
      );
    }
    
    let deletedFiles = [];
    
    // 删除结果文件
    try {
      await unlink(join(RESULTS_DIR, `${fileId}.json`));
      deletedFiles.push('result.json');
    } catch (e) {}
    
    // 删除状态文件
    try {
      await unlink(join(RESULTS_DIR, `${fileId}.status`));
      deletedFiles.push('status');
    } catch (e) {}
    
    // 删除上传文件
    try {
      const uploadFiles = await readdir(UPLOAD_DIR);
      const uploadFile = uploadFiles.find(f => f.startsWith(fileId));
      if (uploadFile) {
        await unlink(join(UPLOAD_DIR, uploadFile));
        deletedFiles.push('upload');
      }
    } catch (e) {}
    
    return NextResponse.json({
      deletedFiles,
      message: '文件已删除'
    });
    
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: '删除失败' },
      { status: 500 }
    );
  }
}