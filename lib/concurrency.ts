import { CONFIG } from './config'

// 处理队列项
interface QueueItem {
  id: string
  filePath: string
  statusPath: string
  fileSize: number
  priority: number
  timestamp: number
}

// 并发控制器 - 简化版本
export class ConcurrencyController {
  private static instance: ConcurrencyController
  private processingQueue: QueueItem[] = []
  private activeProcesses = new Set<string>()
  private isRunning = false

  static getInstance(): ConcurrencyController {
    if (!ConcurrencyController.instance) {
      ConcurrencyController.instance = new ConcurrencyController()
    }
    return ConcurrencyController.instance
  }

  // 添加到处理队列
  async addToQueue(
    id: string,
    filePath: string,
    statusPath: string,
    fileSize: number,
    priority: number = 0
  ): Promise<boolean> {
    // 检查是否已在队列中
    if (this.activeProcesses.has(id) || this.processingQueue.find(item => item.id === id)) {
      return false
    }

    // 添加到队列
    this.processingQueue.push({
      id,
      filePath,
      statusPath,
      fileSize,
      priority,
      timestamp: Date.now()
    })

    // 按优先级排序
    this.processingQueue.sort((a, b) => b.priority - a.priority)

    // 启动处理器
    if (!this.isRunning) {
      this.processQueue()
    }

    return true
  }

  // 处理队列
  private async processQueue() {
    if (this.isRunning) return
    this.isRunning = true

    while (true) {
      // 检查是否可以处理新任务
      if (this.activeProcesses.size < CONFIG.CONCURRENCY.MAX_CONCURRENT_PROCESSES && 
          this.processingQueue.length > 0) {
        
        const item = this.processingQueue.shift()!
        this.activeProcesses.add(item.id)

        // 处理文件
        this.processFile(item).catch(error => {
          console.error(`Processing failed for ${item.id}:`, error)
        }).finally(() => {
          this.activeProcesses.delete(item.id)
        })
      }

      // 等待下一次检查
      await new Promise(resolve => setTimeout(resolve, CONFIG.CONCURRENCY.QUEUE_CHECK_INTERVAL))

      // 如果队列为空且没有活动进程，停止处理
      if (this.processingQueue.length === 0 && this.activeProcesses.size === 0) {
        this.isRunning = false
        break
      }
    }
  }

  // 处理单个文件
  private async processFile(item: QueueItem) {
    const startTime = Date.now()
    const timeout = CONFIG.CONCURRENCY.PROCESSING_TIMEOUT

    // 设置超时检查
    const timeoutCheck = setInterval(() => {
      if (Date.now() - startTime > timeout) {
        console.error(`Processing timeout for ${item.id}`)
        // 这里可以添加超时处理逻辑
      }
    }, 30000) // 每30秒检查一次

    try {
      // 导入处理函数
      const { processFileOptimized } = await import('@/lib/file-processor')
      
      // 处理文件
      await processFileOptimized(item.id, item.filePath, item.statusPath, item.fileSize)
      
      console.log(`File ${item.id} processed successfully`)
    } catch (error) {
      console.error(`Error processing file ${item.id}:`, error)
      
      // 更新状态为失败
      try {
        const { writeFile } = await import('fs/promises')
        await writeFile(item.statusPath, JSON.stringify({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Processing failed',
          failedAt: new Date().toISOString()
        }, null, 2))
      } catch (e) {
        console.error('Failed to write error status:', e)
      }
    } finally {
      clearInterval(timeoutCheck)
    }
  }

  // 获取队列状态
  getQueueStatus() {
    return {
      queueLength: this.processingQueue.length,
      activeProcesses: this.activeProcesses.size,
      isRunning: this.isRunning
    }
  }

  // 清理已完成的项目
  cleanup() {
    // 定期清理旧的状态文件
    this.processingQueue = this.processingQueue.filter(item => {
      const age = Date.now() - item.timestamp
      return age < 24 * 60 * 60 * 1000 // 保留24小时内的
    })
  }
}