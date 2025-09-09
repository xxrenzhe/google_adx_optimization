import { NextRequest, NextResponse } from 'next/server'
import { mkdir, writeFile, readFile, appendFile, unlink } from 'fs/promises'
import { join } from 'path'
import { createReadStream, createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { createInterface } from 'readline'
import { createHash } from 'crypto'
import { CONFIG as FILE_CONFIG, validateFile, createColumnMap, parseCSVLine } from '@/lib/file-processing'
import { CONFIG } from '@/lib/config'
import { ConcurrencyController } from '@/lib/concurrency'
import { LightweightAggregator } from '@/lib/aggregator'

// 内存监控器 - 优化版本，避免频繁GC
class MemoryMonitor {
  private static instance: MemoryMonitor
  private lastCheck = 0
  private lastGC = 0
  private readonly CHECK_INTERVAL = 10000 // 10秒检查一次
  private readonly GC_COOLDOWN = 60000 // GC冷却时间1分钟
  private readonly MEMORY_THRESHOLD = 0.8 // 80%阈值，提高阈值
  
  static getInstance() {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor()
    }
    return MemoryMonitor.instance
  }
  
  checkMemory() {
    const now = Date.now()
    if (now - this.lastCheck < this.CHECK_INTERVAL) return
    
    const mem = process.memoryUsage()
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024)
    const heapUsedRatio = mem.heapUsed / mem.heapTotal
    
    // 只在内存极高时才考虑GC
    if (heapUsedRatio > this.MEMORY_THRESHOLD && now - this.lastGC > this.GC_COOLDOWN) {
      console.warn(`Memory usage critical: ${heapUsedMB}MB (${(heapUsedRatio * 100).toFixed(1)}%)`)
      
      if (global.gc) {
        console.log('Triggering garbage collection as last resort')
        const gcStart = Date.now()
        global.gc()
        const gcDuration = Date.now() - gcStart
        console.log(`GC completed in ${gcDuration}ms`)
        this.lastGC = now
      }
    }
    
    // 更频繁的日志，但不触发GC
    if (heapUsedMB > 700 && heapUsedMB % 50 === 0) {
      console.log(`Memory usage: ${heapUsedMB}MB`)
    }
    
    this.lastCheck = now
  }
  
  // 获取内存使用情况
  getMemoryUsage() {
    const mem = process.memoryUsage()
    return {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      external: Math.round(mem.external / 1024 / 1024),
      rss: Math.round(mem.rss / 1024 / 1024)
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')
    
    if (!fileId) {
      return NextResponse.json({ error: 'Missing fileId' }, { status: 400 })
    }
    
    const statusPath = join(CONFIG.DIRECTORIES.RESULTS_DIR, `${fileId}.status`)
    
    try {
      const statusData = await readFile(statusPath, 'utf-8')
      return NextResponse.json(JSON.parse(statusData))
    } catch (error) {
      return NextResponse.json({ 
        status: 'not_found',
        error: 'File not found'
      }, { status: 404 })
    }
    
  } catch (error) {
    console.error('Status query error:', error)
    return NextResponse.json(
      { error: 'Failed to query status' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // 确保目录存在并可访问
    // 生产环境强制使用/data目录
    if (process.env.NODE_ENV === 'production' && 
        (!CONFIG.DIRECTORIES.UPLOAD_DIR.startsWith('/data') || 
         !CONFIG.DIRECTORIES.RESULTS_DIR.startsWith('/data'))) {
      return NextResponse.json(
        { error: 'Configuration error: Must use /data directory for production' },
        { status: 500 }
      )
    }
    
    try {
      await mkdir(CONFIG.DIRECTORIES.UPLOAD_DIR, { recursive: true })
      await mkdir(CONFIG.DIRECTORIES.RESULTS_DIR, { recursive: true })
      
      // 测试写入权限 - 必须成功
      const testFile = `${CONFIG.DIRECTORIES.UPLOAD_DIR}/.test_${Date.now()}`
      await writeFile(testFile, 'test')
      await unlink(testFile)
      console.log('Directory write test successful')
    } catch (dirError: unknown) {
      console.error('Directory access error:', dirError)
      return NextResponse.json(
        { error: `无法访问/data目录: ${(dirError as Error).message}. 请检查/data卷的挂载和权限配置。` },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: '没有找到文件' }, { status: 400 })
    }

    // 验证文件
    validateFile(file)

    const fileId = crypto.randomUUID()
    const fileName = `${fileId}${file.name.endsWith('.csv') ? '' : '.csv'}`
    const filePath = join(CONFIG.DIRECTORIES.UPLOAD_DIR, fileName)

    // 保存文件
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, fileBuffer)

    // 创建状态文件
    const statusPath = join(CONFIG.DIRECTORIES.RESULTS_DIR, `${fileId}.status`)
    await writeFile(statusPath, JSON.stringify({
      status: 'processing',
      fileName: file.name,
      fileSize: file.size,
      uploadTime: new Date().toISOString(),
      progress: 0
    }))

    // 使用并发控制器管理处理队列
    const controller = ConcurrencyController.getInstance()
    const added = await controller.addToQueue(fileId, filePath, statusPath, file.size)
    
    if (!added) {
      return NextResponse.json({ 
        error: '文件已在处理队列中' 
      }, { status: 400 })
    }

    return NextResponse.json({
      fileId,
      message: '文件上传成功，正在分析中...',
      fileName: file.name,
      fileSize: file.size
    })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? (error as any).message : '文件上传失败' },
      { status: 500 }
    )
  }
}

