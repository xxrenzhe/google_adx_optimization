import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('检查数据库状态...');
  
  // 检查sessionId字段是否存在
  try {
    const sample = await prisma.adReport.findFirst({
      select: { sessionId: true }
    });
    console.log('✅ sessionId字段存在');
    console.log('示例:', sample);
  } catch (e) {
    console.log('❌ sessionId字段不存在:', e.message);
    return;
  }
  
  // 检查legacy数据
  const legacyCount = await prisma.adReport.count({
    where: { sessionId: 'legacy' }
  });
  console.log(`\nlegacy记录数: ${legacyCount}`);
  
  if (legacyCount > 0) {
    console.log('开始迁移legacy数据...');
    
    // 使用Prisma更新，避免SQL问题
    const batchSize = 1000;
    let processed = 0;
    
    while (processed < legacyCount) {
      const records = await prisma.adReport.findMany({
        where: { sessionId: 'legacy' },
        take: batchSize,
        select: { id: true, dataDate: true }
      });
      
      if (records.length === 0) break;
      
      // 批量更新
      for (const record of records) {
        const dateKey = record.dataDate.toISOString().split('T')[0].replace(/-/g, '');
        const sessionId = `legacy_${dateKey}_${String(processed % 1000).padStart(3, '0')}`;
        
        await prisma.adReport.update({
          where: { id: record.id },
          data: { sessionId }
        });
        
        processed++;
      }
      
      console.log(`已处理 ${processed}/${legacyCount} 条记录`);
    }
    
    console.log('✅ 迁移完成');
  }
  
  // 最终验证
  const nullCount = await prisma.adReport.count({
    where: { sessionId: null }
  });
  
  console.log(`\n最终结果:`);
  console.log(`null sessionId记录数: ${nullCount}`);
  
  const totalCount = await prisma.adReport.count();
  console.log(`总记录数: ${totalCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });