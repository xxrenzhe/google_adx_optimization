import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始高效数据迁移...');
  
  // 步骤1：检查表结构
  const tables = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE '%ad%'
  `;
  
  console.log('相关表:', tables);
  
  // 步骤2：直接批量更新
  console.log('正在批量更新legacy数据的sessionId...');
  
  await prisma.$executeRaw`
    UPDATE "AdReport" 
    SET session_id = 'legacy_' || 
                   TO_CHAR(data_date, 'YYYYMMDD') || '_' ||
                   LPAD(
                     (
                       SELECT COUNT(*)::text 
                       FROM "AdReport" r2 
                       WHERE r2.data_date = "AdReport".data_date 
                       AND r2.id <= "AdReport".id
                     )::text, 
                     3, 
                     '0'
                   )
    WHERE session_id = 'legacy'
  `;
  
  // 步骤3：验证
  const result = await prisma.$queryRaw`
    SELECT 
      COUNT(*) as total_count,
      COUNT(session_id) as with_session_id,
      COUNT(*) - COUNT(session_id) as null_count
    FROM "AdReport"
  `;
  
  const stats = result[0];
  
  console.log(`\n迁移完成！`);
  console.log(`总记录数: ${stats.total_count}`);
  console.log(`有sessionId的记录: ${stats.with_session_id}`);
  console.log(`null sessionId记录数: ${stats.null_count}`);
  
  if (stats.null_count === 0) {
    console.log('✅ 所有记录都有sessionId');
  } else {
    console.log('❌ 仍有记录缺少sessionId');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });