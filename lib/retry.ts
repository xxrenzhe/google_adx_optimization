// 错误恢复和重试机制
export class ProcessingError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
    public retryable: boolean = true
  ) {
    super(message)
    this.name = 'ProcessingError'
  }
}

export function isRetryableError(error: any): boolean {
  // 网络错误、超时错误、临时资源不足可以重试
  const retryableCodes = [
    'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED',
    'ENOMEM', 'ENOSPC', 'ECANCELED'
  ]
  
  if (error.code && retryableCodes.includes(error.code)) {
    return true
  }
  
  // 检查是否是ProcessingError且标记为可重试
  if (error instanceof ProcessingError) {
    return error.retryable
  }
  
  return false
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      if (!isRetryableError(error) || attempt === maxRetries) {
        throw error
      }
      
      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`, (error as Error).message)
      await new Promise(resolve => setTimeout(resolve, delay))
      delay *= 2 // 指数退避
    }
  }
  
  throw lastError!
}

// 检查系统资源
export async function checkSystemResources(): Promise<{
  ok: boolean
  memory: NodeJS.MemoryUsage
  diskSpace?: { available: number; total: number }
}> {
  const memory = process.memoryUsage()
  const heapUsedMB = Math.round(memory.heapUsed / 1024 / 1024)
  const heapTotalMB = Math.round(memory.heapTotal / 1024 / 1024)
  
  // 简单的内存检查
  const ok = heapUsedMB < heapTotalMB * 0.9 // 使用不超过90%的堆内存
  
  return {
    ok,
    memory
  }
}