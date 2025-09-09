// 服务器启动初始化
import { resourceMonitor } from './resource-monitor'

// 在生产环境启动资源监控
if (process.env.NODE_ENV === 'production') {
  resourceMonitor.start()
  
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
  console.log('Development mode: Resource monitor started')
}

export { resourceMonitor }