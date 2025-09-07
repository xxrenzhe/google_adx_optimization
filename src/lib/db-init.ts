import { PrismaClient } from '@prisma/client'

// 数据库初始化和优化脚本
// 这个文件会在应用启动时自动执行

const prisma = new PrismaClient()

// 数据库优化锁，防止重复执行
const OPTIMIZATION_LOCK_KEY = 'db_optimization_lock'
const OPTIMIZATION_VERSION = '1.0.0'

export async function initializeDatabase() {
  try {
    console.log('🗄️ Initializing database...')
    
    // 检查是否已经执行过优化
    const optimizationComplete = await checkOptimizationStatus()
    
    if (!optimizationComplete) {
      console.log('🔧 Applying database optimizations...')
      await applyOptimizations()
      await markOptimizationComplete()
      console.log('✅ Database optimizations completed')
    } else {
      console.log('✅ Database already optimized')
    }
    
    // 每次启动时执行轻量级维护
    await performLightMaintenance()
    
  } catch (error) {
    console.error('Database initialization failed:', error)
    // 不要阻止应用启动
  }
}

// 检查优化状态
async function checkOptimizationStatus(): Promise<boolean> {
  try {
    // 创建优化状态表（如果不存在）
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS database_optimizations (
        key VARCHAR(100) PRIMARY KEY,
        version VARCHAR(20),
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        details TEXT
      )
    `
    
    // 检查是否已执行
    const result = await prisma.$queryRaw`
      SELECT version FROM database_optimizations 
      WHERE key = ${OPTIMIZATION_LOCK_KEY}
    ` as Array<{ version: string }>
    
    return result.length > 0 && result[0].version === OPTIMIZATION_VERSION
  } catch (error) {
    console.error('Failed to check optimization status:', error)
    return false
  }
}

// 标记优化完成
async function markOptimizationComplete() {
  try {
    await prisma.$executeRaw`
      INSERT INTO database_optimizations (key, version, details)
      VALUES (${OPTIMIZATION_LOCK_KEY}, ${OPTIMIZATION_VERSION}, 'Initial optimization applied')
      ON CONFLICT (key) DO UPDATE SET
        version = EXCLUDED.version,
        applied_at = CURRENT_TIMESTAMP,
        details = EXCLUDED.details
    `
  } catch (error) {
    console.error('Failed to mark optimization complete:', error)
  }
}

// 应用数据库优化
async function applyOptimizations() {
  try {
    // 1. 为现有表创建优化索引
    console.log('  Creating indexes...')
    
    // ad_reports表索引
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_ad_reports_composite_1 
      ON ad_reports (session_id, data_date DESC, website)
    `
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_ad_reports_composite_2 
      ON ad_reports (website, country, data_date DESC)
    `
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_ad_reports_analytics 
      ON ad_reports (data_date, country, device, ad_format)
    `
    
    // upload_sessions表索引
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_upload_sessions_status 
      ON upload_sessions (status, uploaded_at)
    `
    
    // 2. 创建优化函数
    console.log('  Creating optimization functions...')
    
    await prisma.$executeRaw`
      CREATE OR REPLACE FUNCTION cleanup_old_data()
      RETURNS INTEGER AS $$
      DECLARE
        deleted_count INTEGER;
      BEGIN
        -- 这个函数保留供手动调用，自动清理通过API完成
        RETURN 0;
      END;
      $$ LANGUAGE plpgsql
    `
    
    await prisma.$executeRaw`
      CREATE OR REPLACE FUNCTION get_performance_stats()
      RETURNS TABLE (
        table_name TEXT,
        record_count BIGINT,
        total_size_mb FLOAT
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          t.tablename::TEXT,
          c.reltuples::BIGINT,
          pg_total_relation_size(t.schemaname||'.'||t.tablename)::FLOAT / 1024 / 1024
        FROM pg_tables t
        LEFT JOIN pg_class c ON t.tablename = c.relname
        WHERE t.schemaname = 'public' 
          AND (t.tablename LIKE 'ad_reports%' OR t.tablename LIKE 'upload_sessions')
        GROUP BY t.tablename, c.reltuples;
      END;
      $$ LANGUAGE plpgsql
    `
    
    // 3. 更新统计信息
    console.log('  Updating statistics...')
    await prisma.$executeRaw`ANALYZE`
    
  } catch (error) {
    console.error('Failed to apply optimizations:', error)
    throw error
  }
}

// 轻量级维护（每次启动时执行）
async function performLightMaintenance() {
  try {
    // 清理可能残留的过期临时表
    console.log('🧹 Performing light maintenance...')
    
    const expiredSince = new Date()
    expiredSince.setHours(expiredSince.getHours() - 2) // 2小时前
    
    // 查找过期的临时表
    const expiredSessions = await prisma.uploadSession.findMany({
      where: {
        uploadedAt: {
          lt: expiredSince
        }
      },
      select: {
        id: true,
        tempTableName: true
      }
    })
    
    for (const session of expiredSessions) {
      try {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${session.tempTableName}`)
      } catch (error) {
        // 忽略错误，表可能已被删除
      }
    }
    
    // 更新统计信息
    await prisma.$executeRaw`ANALYZE`
    
    console.log(`✅ Light maintenance completed (cleaned ${expiredSessions.length} potential stale tables)`)
    
  } catch (error) {
    console.error('Light maintenance failed:', error)
  }
}

// 导出清理函数供API使用
export { batchCleanupExpiredData } from './data-cleanup'

// 如果直接运行此脚本
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('Database initialization completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Database initialization failed:', error)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}