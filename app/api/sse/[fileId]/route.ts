import { NextRequest } from 'next/server';
import { readFile, access } from 'fs/promises';
import { join } from 'path';

const RESULTS_DIR = './results';

export async function GET(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  const { fileId } = params;
  
  // 创建 SSE 流
  const stream = new ReadableStream({
    async start(controller) {
      console.log(`[DEBUG] Starting SSE stream for file ${fileId}`);
      
      // 发送初始连接确认
      controller.enqueue(`data: ${JSON.stringify({ type: 'connected', fileId })}\n\n`);
      
      let pollCount = 0;
      const maxPolls = 600; // 最多轮询10分钟
      
      const poll = async () => {
        try {
          // 检查状态文件
          const statusPath = join(RESULTS_DIR, `${fileId}.status`);
          
          try {
            await access(statusPath);
            const statusData = await readFile(statusPath, 'utf-8');
            const status = JSON.parse(statusData);
            
            // 发送状态更新
            controller.enqueue(`data: ${JSON.stringify({ type: 'status', ...status })}\n\n`);
            
            if (status.status === 'completed') {
              // 文件处理完成，发送结果
              const resultPath = join(RESULTS_DIR, `${fileId}.json`);
              try {
                await access(resultPath);
                const resultData = await readFile(resultPath, 'utf-8');
                const result = JSON.parse(resultData);
                
                controller.enqueue(`data: ${JSON.stringify({ type: 'completed', result })}\n\n`);
                console.log(`[DEBUG] SSE stream completed for file ${fileId}`);
                controller.close();
                return;
              } catch (error) {
                console.error(`[DEBUG] Error reading result file:`, error);
              }
            } else if (status.status === 'failed') {
              // 处理失败
              controller.enqueue(`data: ${JSON.stringify({ type: 'failed', error: status.error })}\n\n`);
              controller.close();
              return;
            }
          } catch (error) {
            // 状态文件不存在，可能还在处理中
            if (pollCount === 0) {
              controller.enqueue(`data: ${JSON.stringify({ type: 'processing', progress: 0, message: '初始化中...' })}\n\n`);
            }
          }
          
          pollCount++;
          if (pollCount >= maxPolls) {
            controller.enqueue(`data: ${JSON.stringify({ type: 'timeout', message: '处理超时' })}\n\n`);
            controller.close();
            return;
          }
          
          // 继续轮询
          setTimeout(poll, 1000);
          
        } catch (error) {
          console.error('SSE poll error:', error);
          controller.enqueue(`data: ${JSON.stringify({ type: 'error', message: '连接错误' })}\n\n`);
          controller.close();
        }
      };
      
      // 开始轮询
      poll();
      
      // 清理函数
      return () => {
        console.log(`[DEBUG] SSE stream closed for file ${fileId}`);
        controller.close();
      };
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  });
}