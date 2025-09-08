import { NextRequest, NextResponse } from 'next/server';
import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { FileSystemManager } from '@/lib/fs-manager';

const RESULTS_DIR = './results';

export async function GET(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    const { fileId } = params;
    
    // 首先尝试从FileSystemManager获取结果
    const result = await FileSystemManager.getAnalysisResult(fileId);
    if (result) {
      return NextResponse.json({
        status: 'completed',
        result,
        progress: 100,
        processedLines: result.summary?.totalRows || 0
      });
    }
    
    // 如果FileSystemManager中没有，尝试直接读取文件
    const resultPath = join(RESULTS_DIR, `${fileId}.json`);
    
    try {
      // 检查文件是否存在并可访问
      await access(resultPath);
      
      // 添加一个延迟确保文件写入完成
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 尝试读取文件，如果失败则说明文件正在写入
      let resultData;
      try {
        resultData = await readFile(resultPath, 'utf-8');
      } catch (readError) {
        // 如果读取失败，等待更长时间后重试一次
        console.log(`[DEBUG] File read failed, waiting and retrying...`);
        await new Promise(resolve => setTimeout(resolve, 300));
        try {
          resultData = await readFile(resultPath, 'utf-8');
        } catch (readError2) {
          // 如果还是失败，抛出错误让外层处理
          throw readError2;
        }
      }
      
      const result = JSON.parse(resultData);
      
      return NextResponse.json({
        status: 'completed',
        result,
        progress: 100,
        processedLines: result.summary?.totalRows || 0
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
          // 状态显示完成，但结果文件可能被删除或在写入中
          // 添加延迟后再次尝试读取结果文件
          await new Promise(resolve => setTimeout(resolve, 200));
          
          try {
            await access(resultPath);
            const resultData = await readFile(resultPath, 'utf-8');
            const result = JSON.parse(resultData);
            
            return NextResponse.json({
              status: 'completed',
              result,
              progress: 100,
              processedLines: result.summary?.totalRows || 0
            });
          } catch {
            // 结果文件确实不存在或不可读
            return NextResponse.json({
              status: 'expired',
              message: '分析结果已过期，请重新上传文件'
            }, { status: 410 });
          }
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