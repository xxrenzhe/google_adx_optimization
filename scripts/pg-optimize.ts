#!/usr/bin/env ts-node
import { prisma } from '../lib/prisma-extended'

async function main() {
  console.log('[PG-OPTIMIZE] Start')
  const statements: string[] = [
    // BRIN on dataDate
    `CREATE INDEX IF NOT EXISTS adrep_brin_datadate ON "AdReport" USING brin ("dataDate");`,
    // Common composite indexes
    `CREATE INDEX IF NOT EXISTS adrep_idx_datadate_website ON "AdReport" ("dataDate","website");`,
    `CREATE INDEX IF NOT EXISTS adrep_idx_website_country ON "AdReport" ("website","country");`,
    `CREATE INDEX IF NOT EXISTS adrep_idx_country ON "AdReport" ("country");`,
    `CREATE INDEX IF NOT EXISTS adrep_idx_device ON "AdReport" ("device");`,
    `CREATE INDEX IF NOT EXISTS adrep_idx_adformat ON "AdReport" ("adFormat");`,
    `CREATE INDEX IF NOT EXISTS adrep_idx_advertiser ON "AdReport" ("advertiser");`
  ]

  for (const sql of statements) {
    console.log('[PG-OPTIMIZE] Execute:', sql)
    try {
      // @ts-ignore
      await prisma.$executeRawUnsafe(sql)
    } catch (e) {
      console.warn('[PG-OPTIMIZE] Failed:', (e as Error).message)
    }
  }

  console.log('[PG-OPTIMIZE] ANALYZE AdReport')
  try {
    // @ts-ignore
    await prisma.$executeRawUnsafe(`ANALYZE "AdReport";`)
  } catch (e) {
    console.warn('[PG-OPTIMIZE] ANALYZE failed:', (e as Error).message)
  }

  const enablePartition = process.env.PG_ENABLE_PARTITION === '1'
  if (enablePartition) {
    console.log('[PG-OPTIMIZE] PG_ENABLE_PARTITION=1 → Attempting month partition bootstrap for current year')
    const year = new Date().getFullYear()
    const begin = `${year}-01-01`
    const end = `${year+1}-01-01`
    const partitionSQL = `
DO $$
DECLARE d date := date '${begin}';
BEGIN
  WHILE d < date '${end}' LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.ad_report_%s PARTITION OF public."AdReport" FOR VALUES FROM (%L) TO (%L);',
      to_char(d,'YYYY_MM'), d, (d + interval '1 month')::date
    );
    d := (d + interval '1 month')::date;
  END LOOP;
END$$;
    `
    try {
      // @ts-ignore
      await prisma.$executeRawUnsafe(partitionSQL)
      console.log('[PG-OPTIMIZE] Partition creation attempted.')
    } catch (e) {
      console.warn('[PG-OPTIMIZE] Partition creation failed:', (e as Error).message)
      console.warn('[PG-OPTIMIZE] Note: You must first convert AdReport to a partitioned table. See docs/DB_Optimization_Postgres.md.')
    }
  } else {
    console.log('[PG-OPTIMIZE] Skip partition creation (set PG_ENABLE_PARTITION=1 to attempt). See docs/DB_Optimization_Postgres.md')
  }

  console.log('[PG-OPTIMIZE] Done')
}

main().finally(async ()=>{ await prisma.$disconnect() })

