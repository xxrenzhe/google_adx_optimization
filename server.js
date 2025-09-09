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
  
  // 定期清理内存
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
    }, 30000) // 每30秒检查一次
  }
})