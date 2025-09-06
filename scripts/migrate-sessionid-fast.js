import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始高效数据迁移...');
  
  // 步骤1：直接批量更新，按日期分组
  console.log('正在批量更新legacy数据的sessionId...');
  
  // 使用原生SQL批量更新
  await prisma.$executeRaw`
    UPDATE ad_report 
    SET session_id = 'legacy_' || 
                   TO_CHAR(data_date, 'YYYYMMDD') || '_' ||
                   LPAD(
                     (
                       SELECT COUNT(*)::text 
                       FROM ad_report r2 
                       WHERE r2.data_date = ad_report.data_date 
                       AND r2.id <= ad_report.id
                     )::text, 
                     3, 
                     '0'
                   )
    WHERE session_id = 'legacy'
  `;
  
  // 步骤2：验证
  const result = await prisma.$queryRaw`
    SELECT 
      COUNT(*) as total_count,
      COUNT(session_id) as with_session_id,
      COUNT(*) - COUNT(session_id) as null_count
    FROM ad_report
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
  
  // 步骤3：检查几个示例
  const samples = await prisma.adReport.findMany({
    take: 5,
    select: { id: true, sessionId: true, dataDate: true }
  });
  
  console.log('\n示例记录:');
  samples.forEach(record => {
    console.log(`ID: ${record.id}, Session: ${record.sessionId}, Date: ${record.dataDate}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });