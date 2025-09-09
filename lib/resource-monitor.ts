import { CONFIG } from './config'
import { readdir, unlink, stat } from 'fs/promises'
import { join } from 'path'

// 资源监控器
export class ResourceMonitor {
  private static instance: ResourceMonitor
  private cleanupInterval: NodeJS.Timeout | null = null

  static getInstance(): ResourceMonitor {
    if (!ResourceMonitor.instance) {
      ResourceMonitor.instance = new ResourceMonitor()
    }
    return ResourceMonitor.instance
  }

  // 启动监控
  start() {
    if (this.cleanupInterval) return

    // 立即执行一次清理
    this.cleanup().catch(console.error)

    // 定期清理
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(console.error)
    }, CONFIG.DATA_RETENTION.CLEANUP_INTERVAL_MS)

    console.log('Resource monitor started')
  }

  // 停止监控
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
      console.log('Resource monitor stopped')
    }
  }

  // 清理过期文件
  private async cleanup() {
    const now = Date.now()
    const cutoffTime = now - CONFIG.DATA_RETENTION.RESULT_RETENTION_MS

    try {
      // 清理结果目录
      await this.cleanupDirectory(CONFIG.DIRECTORIES.RESULTS_DIR, cutoffTime)
      
      // 清理上传目录中的残留文件
      await this.cleanupDirectory(CONFIG.DIRECTORIES.UPLOAD_DIR, cutoffTime)

      // 内存清理
      this.cleanupMemory()

      console.log('Cleanup completed')
    } catch (error) {
      console.error('Cleanup failed:', error)
    }
  }

  // 清理指定目录
  private async cleanupDirectory(dirPath: string, cutoffTime: number) {
    try {
      const files = await readdir(dirPath)
      
      for (const file of files) {
        const filePath = join(dirPath, file)
        
        try {
          const stats = await stat(filePath)
          
          // 删除过期文件
          if (stats.mtime.getTime() < cutoffTime) {
            await unlink(filePath)
            console.log(`Deleted expired file: ${file}`)
          }
        } catch (error) {
          console.warn(`Failed to check file ${file}:`, error)
        }
      }
    } catch (error) {
      // 目录不存在是正常的
      if ((error as any).code !== 'ENOENT') {
        throw error
      }
    }
  }

  // 内存清理 - 避免频繁GC影响处理
  private cleanupMemory() {
    const memUsage = process.memoryUsage()
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024)
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024)
    const externalMB = Math.round(memUsage.external / 1024 / 1024)

    console.log(`Memory usage: ${heapUsedMB}/${heapTotalMB}MB, External: ${externalMB}MB`)

    // 只在内存极高时才触发GC，避免影响文件处理
    if (heapUsedMB > 900) { // 提高阈值到900MB
      console.warn('Critical memory usage detected, triggering GC as last resort')
      
      if (global.gc) {
        const gcStart = Date.now()
        global.gc()
        const gcDuration = Date.now() - gcStart
        
        // 检查GC效果
        setTimeout(() => {
          const afterGC = process.memoryUsage()
          const afterMB = Math.round(afterGC.heapUsed / 1024 / 1024)
          console.log(`GC completed in ${gcDuration}ms, freed: ${heapUsedMB - afterMB}MB`)
        }, 100)
      } else {
        console.warn('GC not available, consider running with --expose-gc')
      }
    }
  }

  // 获取系统资源状态
  getResourceStatus() {
    const memUsage = process.memoryUsage()
    const uptime = process.uptime()
    
    return {
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024)
      },
      uptime: Math.round(uptime),
      nodeVersion: process.version,
      platform: process.platform
    }
  }
}

// 全局资源监控实例
export const resourceMonitor = ResourceMonitor.getInstance()