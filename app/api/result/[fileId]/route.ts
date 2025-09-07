import { NextRequest, NextResponse } from 'next/server';
import { readFile, access } from 'fs/promises';
import { join } from 'path';

const RESULTS_DIR = './results';

export async function GET(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    const { fileId } = params;
    
    // 尝试读取分析结果
    const resultPath = join(RESULTS_DIR, `${fileId}.json`);
    
    try {
      await access(resultPath);
      const resultData = await readFile(resultPath, 'utf-8');
      const result = JSON.parse(resultData);
      
      return NextResponse.json({
        status: 'completed',
        result
      });
    } catch (error) {
      // 结果文件不存在，检查状态文件
      const statusPath = join(RESULTS_DIR, `${fileId}.status`);
      
      try {
        await access(statusPath);
        const statusData = await readFile(statusPath, 'utf-8');
        const status = JSON.parse(statusData);
        
        if (status.status === 'processing') {
          return NextResponse.json({
            status: 'processing',
            progress: status.progress || 0,
            processedLines: status.processedLines || 0,
            fileName: status.fileName,
            uploadTime: status.uploadTime
          }, { status: 202 });
        } else if (status.status === 'failed') {
          return NextResponse.json({
            status: 'failed',
            error: status.error || '处理失败',
            failedAt: status.failedAt
          }, { status: 500 });
        } else if (status.status === 'completed') {
          // 状态显示完成，但结果文件可能被删除
          return NextResponse.json({
            status: 'expired',
            message: '分析结果已过期，请重新上传文件'
          }, { status: 410 });
        }
      } catch {
        // 状态文件也不存在
        return NextResponse.json({
          status: 'not_found',
          message: '找不到指定的文件'
        }, { status: 404 });
      }
    }
    
  } catch (error) {
    console.error('Error fetching result:', error);
    return NextResponse.json(
      { error: '获取分析结果失败' },
      { status: 500 }
    );
  }
}