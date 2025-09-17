// 服务器启动初始化
import { resourceMonitor } from './resource-monitor'
import { softInitIfEnabled } from './db-soft-init'

// 在生产环境启动资源监控
if (process.env.NODE_ENV === 'production') {
  resourceMonitor.start()
  // Optional DB soft init (create minimal tables) when enabled by env
  softInitIfEnabled()
  
  // 优雅关闭
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...')
    resourceMonitor.stop()
    process.exit(0)
  })
  
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...')
    resourceMonitor.stop()
    process.exit(0)
  })
}

// 开发环境下也启动，但输出更多日志
if (process.env.NODE_ENV === 'development') {
  resourceMonitor.start()
  softInitIfEnabled()
  console.log('Development mode: Resource monitor started')
}

export { resourceMonitor }
