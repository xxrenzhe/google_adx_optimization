const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:w8mhnnqh@dbprovider.sg-members-1.clawcloudrun.com:32404/adx_optimization?directConnection=true&charset=utf8&pool_timeout=20&connect_timeout=10"
    }
  }
});

async function checkDatabase() {
  try {
    await prisma.$connect();
    
    // Check recent sessions
    const sessions = await prisma.uploadSession.findMany({
      take: 5,
      orderBy: { uploadedAt: 'desc' }
    });
    
    console.log('Recent upload sessions:');
    sessions.forEach((session, i) => {
      console.log(`\n${i + 1}. ${session.filename}`);
      console.log(`   ID: ${session.id}`);
      console.log(`   Status: ${session.status}`);
      console.log(`   Records: ${session.recordCount || 'N/A'}`);
      console.log(`   Uploaded: ${session.uploadedAt}`);
    });
    
    // Check total records
    const totalRecords = await prisma.adReport.count();
    console.log(`\nTotal records in database: ${totalRecords.toLocaleString()}`);
    
    // Check recent records if any
    if (totalRecords > 0) {
      const recentRecord = await prisma.adReport.findFirst({
        orderBy: { dataDate: 'desc' }
      });
      
      if (recentRecord) {
        console.log(`\nMost recent record:`);
        console.log(`   Website: ${recentRecord.website}`);
        console.log(`   Date: ${recentRecord.dataDate}`);
        console.log(`   Revenue: $${recentRecord.revenue}`);
        console.log(`   Session ID: ${recentRecord.sessionId}`);
      }
    }
    
    // Check unique session IDs
    const uniqueSessions = await prisma.adReport.groupBy({
      by: ['sessionId'],
      _count: { sessionId: true },
      orderBy: { _count: { sessionId: 'desc' } },
      take: 5
    });
    
    console.log('\nTop 5 sessions by record count:');
    uniqueSessions.forEach((session, i) => {
      console.log(`   ${i + 1}. ${session.sessionId}: ${session._count.sessionId.toLocaleString()} records`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();