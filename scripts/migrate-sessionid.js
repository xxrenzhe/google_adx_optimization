import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始数据迁移...');
  
  // 步骤1：更新legacy数据
  console.log('正在更新legacy数据的sessionId...');
  const legacyRecords = await prisma.adReport.findMany({
    where: { sessionId: 'legacy' },
    select: { id: true, dataDate: true }
  });
  
  console.log(`找到 ${legacyRecords.length} 条legacy记录`);
  
  // 按日期分组
  const recordsByDate = new Map();
  legacyRecords.forEach(record => {
    const dateKey = record.dataDate.toISOString().split('T')[0];
    if (!recordsByDate.has(dateKey)) {
      recordsByDate.set(dateKey, []);
    }
    recordsByDate.get(dateKey).push(record.id);
  });
  
  // 批量更新
  for (const [date, ids] of recordsByDate.entries()) {
    for (let i = 0; i < ids.length; i++) {
      const sessionId = `legacy_${date.replace(/-/g, '')}_${String(i + 1).padStart(3, '0')}`;
      
      await prisma.adReport.update({
        where: { id: ids[i] },
        data: { sessionId }
      });
    }
    console.log(`已更新 ${date} 的 ${ids.length} 条记录`);
  }
  
  // 步骤2：验证
  const nullCount = await prisma.adReport.count({
    where: { sessionId: null }
  });
  
  console.log(`\n迁移完成！`);
  console.log(`null sessionId记录数: ${nullCount}`);
  
  if (nullCount === 0) {
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