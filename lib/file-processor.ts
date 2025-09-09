import { CONFIG } from './config'
import { LightweightAggregator } from './aggregator'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { parseCSVLine, createColumnMap } from './file-processing'

// 优化的文件处理函数
export async function processFileOptimized(fileId: string, filePath: string, statusPath: string, fileSize: number) {
  const aggregator = new LightweightAggregator()
  let processedBytes = 0
  let lastProgressUpdate = 0
  
  try {
    const stream = createReadStream(filePath, { highWaterMark: 64 * 1024 }) // 64KB缓冲区
    const rl = createInterface({
      input: stream,
      crlfDelay: Infinity,
      terminal: false
    })

    let lineCount = 0
    let columnMap: Record<string, number> = {}

    for await (const line of rl) {
      if (lineCount === 0) {
        const headers = parseCSVLine(line)
        columnMap = createColumnMap(headers)
        
        if (columnMap.date === undefined || columnMap.website === undefined) {
          throw new Error('CSV文件必须包含日期和网站列')
        }
        
        aggregator.setColumnMap(columnMap)
        lineCount++
        processedBytes += line.length + 1
        continue
      }

      const cols = parseCSVLine(line)
      aggregator.processRow(cols, columnMap)
      
      // 减少进度更新频率
      const now = Date.now()
      if (now - lastProgressUpdate > 5000) { // 每5秒更新一次
        const progress = Math.min(95, (processedBytes / fileSize) * 100)
        
        try {
          await writeFile(statusPath, JSON.stringify({
            status: 'processing',
            progress: Math.floor(progress),
            processedLines: aggregator['processedLines']
          }, null, 2))
          lastProgressUpdate = now
        } catch (e) {
          console.warn('Failed to update progress:', e)
        }
      }
      
      processedBytes += line.length + 1
      lineCount++
    }

    // 生成并写入结果
    const result = aggregator.getResult(fileId, filePath.split('/').pop() || '')
    
    // 写入结果文件（在cleanup之前）
    const resultPath = join(CONFIG.DIRECTORIES.RESULTS_DIR, `${fileId}.json`)
    await writeFile(resultPath, JSON.stringify(result, null, 2))
    
    // 更新完成状态
    await writeFile(statusPath, JSON.stringify({
      status: 'completed',
      progress: 100,
      processedLines: aggregator['processedLines'],
      completedAt: new Date().toISOString(),
      resultPath
    }, null, 2))
    
    // 清理内存
    aggregator.cleanup()
    
    // 删除原始文件
    try {
      await unlink(filePath)
    } catch (e) {
      console.warn('Failed to delete original file:', e)
    }
    
    console.log(`File ${fileId} processed successfully. ${aggregator['processedLines']} rows.`)

  } catch (error) {
    console.error('Processing error:', error)
    aggregator.cleanup()
    throw error
  }
}