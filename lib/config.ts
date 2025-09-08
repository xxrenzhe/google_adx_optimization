// 系统配置管理
export const CONFIG = {
  // 数据保留配置
  DATA_RETENTION: {
    // 分析结果保留时间（毫秒）
    RESULT_RETENTION_MS: 24 * 60 * 60 * 1000, // 24小时
    // 清理检查间隔（毫秒）
    CLEANUP_INTERVAL_MS: 60 * 60 * 1000, // 1小时
  },
  
  // SSE配置
  SSE: {
    // 连接超时时间（毫秒）
    TIMEOUT_MS: 30 * 60 * 1000, // 30分钟
  },
  
  // 文件上传配置
  UPLOAD: {
    MAX_FILE_SIZE: 200 * 1024 * 1024, // 200MB
    BATCH_SIZE: 1000,
    SAMPLE_SIZE: 100,
  },
  
  // 目录配置
  DIRECTORIES: {
    UPLOAD_DIR: './uploads',
    RESULTS_DIR: './results',
  }
} as const;

// 便于使用的导出
export const DATA_RETENTION_HOURS = CONFIG.DATA_RETENTION.RESULT_RETENTION_MS / (60 * 60 * 1000);