#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function isPartitioned() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT 1
    FROM pg_partitioned_table pt
    JOIN pg_class c ON c.oid = pt.partrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'AdReport';
  `)
  return Array.isArray(rows) && rows.length > 0
}

async function getMinMaxDates() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT MIN("dataDate") AS min_date, MAX("dataDate") AS max_date FROM "AdReport";
  `)
  const r = rows && rows[0] || {}
  return { min: r.min_date ? new Date(r.min_date) : null, max: r.max_date ? new Date(r.max_date) : null }
}

function monthRange(min, max) {
  if (!min || !max) return []
  const start = new Date(min.getFullYear(), min.getMonth(), 1)
  const end = new Date(max.getFullYear(), max.getMonth(), 1)
  const out = []
  let cur = start
  while (cur <= end) {
    const next = new Date(cur.getFullYear(), cur.getMonth()+1, 1)
    out.push({ from: new Date(cur), to: new Date(next) })
    cur = next
  }
  return out
}

async function createPartitions(ranges) {
  for (const r of ranges) {
    const name = `ad_report_${r.from.getFullYear()}_${String(r.from.getMonth()+1).padStart(2,'0')}`
    const sql = `CREATE TABLE IF NOT EXISTS public.${name} PARTITION OF public."AdReport" FOR VALUES FROM ('${r.from.toISOString().slice(0,10)}') TO ('${r.to.toISOString().slice(0,10)}');`
    try { await prisma.$executeRawUnsafe(sql) } catch (e) { console.warn('[PARTITION] create failed:', e.message) }
  }
}

async function convertToPartitioned() {
  console.log('[PARTITION] Start conversion to partitioned table')
  await prisma.$executeRawUnsafe('BEGIN;')
  try {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS public.ad_report_partitioned (LIKE public."AdReport" INCLUDING ALL) PARTITION BY RANGE ("dataDate");`)
    // Ensure unique constraint exists on the partitioned table
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'adrep_unique'
        ) THEN
          ALTER TABLE public.ad_report_partitioned
          ADD CONSTRAINT adrep_unique UNIQUE ("dataDate","website","country","device","browser","adFormat","adUnit","advertiser","domain");
        END IF;
      END$$;
    `)
    await prisma.$executeRawUnsafe(`INSERT INTO public.ad_report_partitioned SELECT * FROM public."AdReport";`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public."AdReport" RENAME TO "AdReport_backup";`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.ad_report_partitioned RENAME TO "AdReport";`)
    await prisma.$executeRawUnsafe('COMMIT;')
    console.log('[PARTITION] Swap done')
  } catch (e) {
    await prisma.$executeRawUnsafe('ROLLBACK;').catch(()=>{})
    throw e
  }

  const { min, max } = await getMinMaxDates()
  const ranges = monthRange(min, max)
  console.log(`[PARTITION] Will create ${ranges.length} monthly partitions`)
  await createPartitions(ranges)
}

async function main() {
  try {
    if (!process.env.DATABASE_URL) {
      console.log('[PARTITION] Skip: no DATABASE_URL')
      return
    }
    const allow = process.env.ALLOW_PARTITION_CONVERSION === '1'
    if (!allow) {
      console.log('[PARTITION] Disabled (set ALLOW_PARTITION_CONVERSION=1 to enable)')
      return
    }
    const part = await isPartitioned()
    if (part) {
      console.log('[PARTITION] AdReport already partitioned; ensure current year partitions exist')
      const y = new Date().getFullYear()
      const ranges = monthRange(new Date(y,0,1), new Date(y,11,1))
      await createPartitions(ranges)
      return
    }
    await convertToPartitioned()
  } catch (e) {
    console.error('[PARTITION] Error:', e.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()

