import { NextRequest, NextResponse } from 'next/server'
import { ConcurrencyController } from '@/lib/concurrency'
import { resourceMonitor } from '@/lib/resource-monitor'

export async function GET(request: NextRequest) {
  try {
    // 获取系统资源状态
    const resourceStatus = resourceMonitor.getResourceStatus()
    
    // 获取并发控制器状态
    const queueStatus = ConcurrencyController.getInstance().getQueueStatus()
    
    // 计算健康状态
    const isHealthy = resourceStatus.memory.heapUsed < 900 && // 内存使用小于900MB
                     queueStatus.activeProcesses <= 2 &&     // 活动进程不超过2个
                     process.uptime() > 10                    // 服务运行超过10秒
    
    // 构建响应
    const healthStatus = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        memory: {
          status: resourceStatus.memory.heapUsed < 900 ? 'ok' : 'warning',
          usage: `${resourceStatus.memory.heapUsed}MB`,
          threshold: '900MB'
        },
        processes: {
          status: queueStatus.activeProcesses <= 2 ? 'ok' : 'warning',
          active: queueStatus.activeProcesses,
          queued: queueStatus.queueLength,
          threshold: 2
        },
        uptime: {
          status: process.uptime() > 10 ? 'ok' : 'warning',
          value: `${Math.round(process.uptime())}s`,
          threshold: '10s'
        }
      },
      system: {
        nodeVersion: resourceStatus.nodeVersion,
        platform: resourceStatus.platform,
        uptime: resourceStatus.uptime
      }
    }

    // 设置响应状态码
    const statusCode = isHealthy ? 200 : 503
    
    return NextResponse.json(healthStatus, { status: statusCode })
  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}