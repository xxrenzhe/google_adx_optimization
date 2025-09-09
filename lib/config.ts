// 系统配置管理
export const CONFIG = {
  // 数据保留配置
  DATA_RETENTION: {
    // 分析结果保留时间（毫秒）
    RESULT_RETENTION_MS: 24 * 60 * 60 * 1000, // 24小时
    // 清理检查间隔（毫秒）
    CLEANUP_INTERVAL_MS: 60 * 60 * 1000, // 1小时
    // 紧急清理阈值（字节）- 当磁盘使用超过8GB时触发紧急清理
    EMERGENCY_CLEANUP_THRESHOLD: 8 * 1024 * 1024 * 1024, // 8GB
  },
  
  // SSE配置
  SSE: {
    // 连接超时时间（毫秒）
    TIMEOUT_MS: 30 * 60 * 1000, // 30分钟
  },
  
  // 文件上传配置
  UPLOAD: {
    MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
    BATCH_SIZE: 1000,
    SAMPLE_SIZE: 100,
  },

  // 并发控制配置 - 1C2G环境优化
  CONCURRENCY: {
    // 最大并发上传数
    MAX_CONCURRENT_UPLOADS: 2,
    // 单个文件处理的最大并发数
    MAX_CONCURRENT_PROCESSES: 1,
    // 队列检查间隔
    QUEUE_CHECK_INTERVAL: 1000,
    // 处理超时时间
    PROCESSING_TIMEOUT: 60 * 60 * 1000, // 1小时
  },
  
  // 目录配置 - 生产环境必须使用/data目录
  DIRECTORIES: {
    UPLOAD_DIR: process.env.NODE_ENV === 'production' ? '/data/uploads' : './uploads',
    RESULTS_DIR: process.env.NODE_ENV === 'production' ? '/data/results' : './results',
  },
  
  // 验证配置
  validate() {
    if (process.env.NODE_ENV === 'production') {
      if (!this.DIRECTORIES.UPLOAD_DIR.startsWith('/data') || 
          !this.DIRECTORIES.RESULTS_DIR.startsWith('/data')) {
        throw new Error('Production environment must use /data directory');
      }
    }
  }
} as const;

// 执行验证
if (process.env.NODE_ENV === 'production') {
  try {
    CONFIG.validate();
  } catch (error: unknown) {
    console.error('Configuration validation failed:', (error as any).message);
    process.exit(1);
  }
}

// 便于使用的导出
export const DATA_RETENTION_HOURS = CONFIG.DATA_RETENTION.RESULT_RETENTION_MS / (60 * 60 * 1000);