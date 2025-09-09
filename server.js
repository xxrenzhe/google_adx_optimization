#!/usr/bin/env node

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

// 启动资源监控
if (process.env.NODE_ENV === 'production') {
  console.log('Starting resource monitor...')
  // 资源监控将在应用初始化时启动
}

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = process.env.PORT || 3000

// 1C2G环境下的内存限制
if (dev) {
  process.env.NODE_OPTIONS = '--max-old-space-size=1536' // 开发环境1.5GB
} else {
  process.env.NODE_OPTIONS = '--max-old-space-size=1024' // 生产环境1GB
}

const app = next({ dev, hostname, port })
const handler = app.getRequestHandler()

// 设置超时 - 1C2G环境下需要更长
const serverTimeout = dev ? 600000 : 900000 // 10分钟（开发）/ 15分钟（生产）

app.prepare().then(() => {
  // 生产环境启动时立即执行清理
  if (!dev) {
    console.log('Production startup: executing initial cleanup...')
    const { exec } = require('child_process')
    
    // 异步执行清理，不阻塞启动
    exec('curl -s http://localhost:3000/api/data-cleanup || echo "Cleanup API not ready yet"', (error) => {
      if (error) {
        console.log('Initial cleanup deferred (server not ready yet)')
      } else {
        console.log('Initial cleanup completed')
      }
    })
  }
  createServer(async (req, res) => {
    try {
      // 增加上传文件大小限制
      if (req.url?.startsWith('/api/upload-optimized')) {
        // 不限制请求体大小，由应用自己处理
      }
      
      const parsedUrl = parse(req.url, true)
      await handler(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })
    .setTimeout(serverTimeout)
    .listen(port, (err) => {
      if (err) throw err
      console.log(`> Ready on http://${hostname}:${port}`)
    })
  
  // 定期清理内存和监控存储
  if (!dev) {
    setInterval(() => {
      const memUsage = process.memoryUsage()
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024)
      
      if (heapUsedMB > 1000) { // 超过1GB
        console.log(`High memory usage detected: ${heapUsedMB}MB, triggering GC`)
        if (global.gc) {
          global.gc()
        }
      }
    }, 30000) // 每30秒检查一次内存
    
    // 每5分钟检查一次存储使用情况
    setInterval(() => {
      const { exec } = require('child_process')
      exec('curl -s http://localhost:3000/api/storage-monitor || echo "Storage monitor not available"', (error) => {
        if (error) {
          console.log('Storage monitor check failed')
        }
      })
    }, 300000) // 5分钟
  }
})