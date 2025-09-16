#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function tableExists(name) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname=$1
  `, name)
  return Array.isArray(rows) && rows.length > 0
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[ROLLBACK] Missing DATABASE_URL')
    process.exit(1)
  }
  const hasBackup = await tableExists('AdReport_backup')
  if (!hasBackup) {
    console.error('[ROLLBACK] AdReport_backup not found; nothing to rollback to')
    process.exit(2)
  }
  console.log('[ROLLBACK] Starting rollback...')
  await prisma.$executeRawUnsafe('BEGIN;')
  try {
    const hasCurrent = await tableExists('AdReport')
    if (hasCurrent) {
      await prisma.$executeRawUnsafe('ALTER TABLE public."AdReport" RENAME TO "AdReport_partitioned_backup";')
      console.log('[ROLLBACK] Renamed current AdReport -> AdReport_partitioned_backup')
    }
    await prisma.$executeRawUnsafe('ALTER TABLE public."AdReport_backup" RENAME TO "AdReport";')
    console.log('[ROLLBACK] Swapped backup -> AdReport')
    await prisma.$executeRawUnsafe('COMMIT;')
    console.log('[ROLLBACK] Done')
  } catch (e) {
    await prisma.$executeRawUnsafe('ROLLBACK;').catch(()=>{})
    console.error('[ROLLBACK] Error:', e.message)
    process.exit(3)
  } finally {
    await prisma.$disconnect()
  }
}

main()

