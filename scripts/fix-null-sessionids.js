import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixNullSessionIds() {
  console.log('Finding records with null sessionId...');
  
  const nullRecords = await prisma.adReport.findMany({
    where: { sessionId: null },
    take: 5,
    select: { id: true, dataDate: true }
  });
  
  console.log(`Found ${nullRecords.length} sample records with null sessionId`);
  
  if (nullRecords.length > 0) {
    console.log('Updating null sessionId records to legacy format...');
    
    // Update all null records to use legacy format
    const updateResult = await prisma.adReport.updateMany({
      where: { sessionId: null },
      data: { sessionId: 'legacy' }
    });
    
    console.log(`Updated ${updateResult.count} records to 'legacy' sessionId`);
  }
  
  // Check final status
  const finalNullCount = await prisma.adReport.count({
    where: { sessionId: null }
  });
  
  console.log(`\nFinal null sessionId count: ${finalNullCount}`);
  
  await prisma.$disconnect();
}

fixNullSessionIds().catch(console.error);