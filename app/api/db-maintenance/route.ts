import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 数据库维护API
export async function GET(request: NextRequest) {
  try {
    // 注意：CRON_SECRET已移除，如需保护此端点，请实现其他认证方式
    
    const results = await performDatabaseMaintenance()
    
    return NextResponse.json({
      message: 'Database maintenance completed',
      results,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Database maintenance error:', error)
    return NextResponse.json(
      { error: 'Failed to perform database maintenance' },
      { status: 500 }
    )
  }
}

// 执行数据库维护
async function performDatabaseMaintenance() {
  const results = {
    vacuum: false,
    analyze: false,
    reindex: false,
    updateStats: false,
    errors: [] as string[],
    tablesProcessed: 0
  }
  
  try {
    // 1. VACUUM - 回收空间并更新统计信息
    try {
      console.log('Starting VACUUM...')
      await prisma.$executeRaw`VACUUM ANALYZE`
      results.vacuum = true
      console.log('VACUUM completed')
    } catch (error) {
      console.error('VACUUM failed:', error)
      results.errors.push('VACUUM failed: ' + (error instanceof Error ? error.message : String(error)))
    }
    
    // 2. 更新表统计信息
    try {
      console.log('Updating table statistics...')
      
      // 获取所有用户表的名称
      const tables = await prisma.$queryRaw`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename NOT LIKE 'pg_%'
          AND tablename NOT LIKE 'information_schema%'
          AND tablename LIKE '%temp%'
      `
      
      for (const table of tables as any[]) {
        try {
          await prisma.$executeRawUnsafe(`ANALYZE ${table.tablename}`)
          results.tablesProcessed++
        } catch (e) {
          console.error(`Failed to analyze ${table.tablename}:`, e)
        }
      }
      
      results.updateStats = true
      console.log(`Updated statistics for ${results.tablesProcessed} tables`)
    } catch (error) {
      console.error('Update stats failed:', error)
      results.errors.push('Update stats failed: ' + (error instanceof Error ? error.message : String(error)))
    }
    
    // 3. 重建碎片化严重的索引
    try {
      console.log('Checking for fragmented indexes...')
      
      // 查找碎片化严重的索引
      const fragmentedIndexes = await prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          indexname,
          pg_size_pretty(pg_relation_size(schemaname||'.'||indexname)) as index_size,
          idx_scan as index_scans
        FROM pg_stat_user_indexes
        WHERE idx_scan < 100  -- 很少使用的索引
          AND schemaname = 'public'
          AND tablename LIKE '%temp%'
        ORDER BY pg_relation_size(schemaname||'.'||indexname) DESC
      `
      
      for (const index of fragmentedIndexes as any[]) {
        try {
          console.log(`Reindexing ${index.indexname}...`)
          await prisma.$executeRawUnsafe(`REINDEX INDEX ${index.indexname}`)
          results.reindex = true
        } catch (e) {
          console.error(`Failed to reindex ${index.indexname}:`, e)
        }
      }
    } catch (error) {
      console.error('Reindex failed:', error)
      results.errors.push('Reindex failed: ' + (error instanceof Error ? error.message : String(error)))
    }
    
    // 4. 清理旧的数据库日志
    try {
      console.log('Cleaning up old database logs...')
      
      // 删除30天前的错误日志（如果有错误日志表）
      await prisma.$executeRaw`
        DELETE FROM error_logs 
        WHERE created_at < NOW() - INTERVAL '30 days'
      `.catch(() => {
        // 忽略错误，表可能不存在
      })
    } catch (error) {
      // 忽略错误
    }
    
    // 5. 获取数据库统计信息
    const dbStats = await getDatabaseStats()
    
    console.log('Database maintenance completed:', results)
    
    return {
      ...results,
      databaseStats: dbStats
    }
    
  } catch (error) {
    console.error('Database maintenance failed:', error)
    throw error
  }
}

// 获取数据库统计信息
async function getDatabaseStats() {
  try {
    const stats = await prisma.$queryRaw`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as db_size,
        (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') as table_count,
        (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public') as index_count,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        pg_size_pretty(pg_total_relation_size('pg_catalog.pg_class')) as catalog_size
    `
    
    return (stats as any[])[0]
  } catch (error) {
    console.error('Failed to get database stats:', error)
    return null
  }
}