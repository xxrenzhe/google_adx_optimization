import { initializeDatabase } from './db-init'

// 数据库初始化中间件
// 这个文件会在Next.js应用启动时自动执行

export async function runDatabaseInitialization() {
  try {
    console.log('🚀 Starting database initialization...')
    await initializeDatabase()
    console.log('✅ Database initialization completed')
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    // 不阻止应用启动，但记录错误
  }
}

// 导出供其他模块使用
export { initializeDatabase } from './db-init'