#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const DEFAULT_QUERIES = {
  'home.benefit_summary': `SELECT dataDate::date AS day, SUM(revenue)::numeric AS revenue FROM "AdReport" WHERE dataDate BETWEEN :from AND :to GROUP BY 1 ORDER BY 1;`,
  'home.top_domains': `SELECT website, SUM(impressions)::bigint AS impressions, SUM(clicks)::bigint AS clicks, CASE WHEN SUM(impressions)>0 THEN SUM(clicks)::numeric/SUM(impressions)*100 ELSE 0 END AS ctr, CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm, SUM(revenue)::numeric AS revenue FROM "AdReport" WHERE dataDate BETWEEN :from AND :to GROUP BY website ORDER BY revenue DESC LIMIT 50;`,
  'home.top_domains_kpi': `WITH rev_site_day AS (
    SELECT dataDate::date AS day, website,
           SUM(COALESCE(revenue,0))::numeric AS revenue,
           SUM(COALESCE(impressions,0))::bigint AS impressions,
           SUM(COALESCE(clicks,0))::bigint AS clicks
    FROM "AdReport"
    WHERE dataDate BETWEEN :from AND :to
    GROUP BY 1, website
  ), cost_site_day AS (
    SELECT dataDate::date AS day, website,
           SUM(COALESCE(cost,0))::numeric AS cost,
           SUM(COALESCE(clicks,0))::bigint AS paid_clicks
    FROM "ad_costs"
    WHERE dataDate BETWEEN :from AND :to
    GROUP BY 1, website
  )
  SELECT s.website,
         SUM(s.impressions)::bigint AS impressions,
         SUM(s.clicks)::bigint AS clicks,
         CASE WHEN SUM(s.impressions)>0 THEN SUM(s.clicks)::numeric/SUM(s.impressions)*100 ELSE 0 END AS ctr,
         CASE WHEN SUM(s.impressions)>0 THEN SUM(s.revenue)::numeric/SUM(s.impressions)*1000 ELSE 0 END AS ecpm,
         SUM(s.revenue)::numeric AS revenue,
         SUM(COALESCE(c.cost,0))::numeric AS cost,
         CASE WHEN SUM(s.clicks)>0 THEN SUM(COALESCE(c.cost,0))::numeric/NULLIF(SUM(s.clicks),0) ELSE NULL END AS cpc,
         CASE WHEN SUM(COALESCE(c.cost,0))>0 THEN SUM(s.revenue)::numeric/SUM(COALESCE(c.cost,0))*100 ELSE NULL END AS roi
  FROM rev_site_day s
  LEFT JOIN cost_site_day c ON c.day = s.day AND c.website = s.website
  GROUP BY s.website
  ORDER BY revenue DESC
  LIMIT 50;`,
  'report.timeseries': `SELECT dataDate::date AS day, SUM(revenue)::numeric AS revenue, SUM(impressions)::bigint AS impressions, SUM(clicks)::bigint AS clicks, CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm FROM "AdReport" WHERE website = :site AND dataDate BETWEEN :from AND :to GROUP BY 1 ORDER BY 1;`,
  'report.device_browser': `SELECT device, browser, SUM(revenue)::numeric AS revenue, SUM(impressions)::bigint AS impressions, SUM(clicks)::bigint AS clicks FROM "AdReport" WHERE website = :site AND dataDate BETWEEN :from AND :to GROUP BY 1,2 ORDER BY revenue DESC LIMIT 100;`,
  'report.country_table': `SELECT country, SUM(impressions)::bigint AS impressions, SUM(clicks)::bigint AS clicks, CASE WHEN SUM(impressions)>0 THEN SUM(clicks)::numeric/SUM(impressions)*100 ELSE 0 END AS ctr, CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm, SUM(revenue)::numeric AS revenue FROM "AdReport" WHERE website = :site AND dataDate BETWEEN :from AND :to GROUP BY country ORDER BY revenue DESC LIMIT 200;`,
  'analytics.revenue_by_day': `SELECT dataDate::date AS day, SUM(revenue)::numeric AS revenue FROM "AdReport" WHERE dataDate BETWEEN :from AND :to GROUP BY 1 ORDER BY 1;`,
  'analytics.revenue_by_country': `SELECT country, SUM(revenue)::numeric AS revenue FROM "AdReport" WHERE dataDate BETWEEN :from AND :to GROUP BY country ORDER BY revenue DESC LIMIT 20;`,
  'analytics.revenue_by_device': `SELECT device, SUM(revenue)::numeric AS revenue FROM "AdReport" WHERE dataDate BETWEEN :from AND :to GROUP BY device ORDER BY revenue DESC;`,
  'analytics.ecpm_distribution': `WITH rows AS (
    SELECT CASE WHEN COALESCE(impressions,0)>0 THEN COALESCE(revenue,0)::numeric/NULLIF(COALESCE(impressions,0),0)::numeric*1000 ELSE 0 END AS ecpm,
           COALESCE(impressions,0) AS impressions
    FROM "AdReport" WHERE dataDate BETWEEN :from AND :to
  )
  SELECT bucket,
         SUM(impressions)::bigint AS impressions
  FROM (
    SELECT CASE
      WHEN ecpm < 10 THEN '$0-10'
      WHEN ecpm < 25 THEN '$10-25'
      WHEN ecpm < 50 THEN '$25-50'
      WHEN ecpm < 100 THEN '$50-100'
      ELSE '$100+'
    END AS bucket,
    impressions
    FROM rows
  ) t
  GROUP BY bucket
  ORDER BY CASE bucket WHEN '$0-10' THEN 1 WHEN '$10-25' THEN 2 WHEN '$25-50' THEN 3 WHEN '$50-100' THEN 4 ELSE 5 END;`,
  'enhanced.advertisers': `SELECT advertiser, SUM(revenue)::numeric AS revenue, SUM(impressions)::bigint AS impressions, SUM(clicks)::bigint AS clicks,
     CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm,
     CASE WHEN SUM(impressions)>0 THEN SUM(clicks)::numeric/SUM(impressions)*100 ELSE 0 END AS ctr
   FROM "AdReport" WHERE dataDate BETWEEN :from AND :to GROUP BY advertiser ORDER BY revenue DESC LIMIT 20;`,
  'enhanced.device_browser_matrix': `SELECT device, browser,
     SUM(revenue)::numeric AS revenue,
     SUM(impressions)::bigint AS impressions,
     CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm
   FROM "AdReport" WHERE dataDate BETWEEN :from AND :to GROUP BY device, browser ORDER BY revenue DESC LIMIT 200;`,
  'enhanced.top_combinations': `SELECT country, device, adFormat,
     SUM(revenue)::numeric AS revenue,
     SUM(impressions)::bigint AS impressions,
     CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm
   FROM "AdReport" WHERE dataDate BETWEEN :from AND :to GROUP BY country, device, adFormat ORDER BY ecpm DESC, revenue DESC LIMIT 20;`,
  'alerts.summary': `SELECT SUM(revenue)::numeric AS revenue, SUM(impressions)::bigint AS impressions, SUM(clicks)::bigint AS clicks, CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm, CASE WHEN SUM(impressions)>0 THEN SUM(clicks)::numeric/SUM(impressions)*100 ELSE 0 END AS ctr FROM "AdReport" WHERE dataDate BETWEEN :from AND :to;`
  ,
  'home.classified_advertiser': `SELECT advertiser, SUM(COALESCE(revenue,0))::numeric AS revenue, SUM(COALESCE(impressions,0))::bigint AS impressions, SUM(COALESCE(clicks,0))::bigint AS clicks,
     CASE WHEN SUM(COALESCE(impressions,0))>0 THEN SUM(COALESCE(revenue,0))::numeric/SUM(COALESCE(impressions,0))::numeric*1000 ELSE 0 END AS ecpm
   FROM "AdReport" WHERE dataDate BETWEEN :from AND :to GROUP BY advertiser ORDER BY revenue DESC LIMIT 12;`,
  // breakdown for home Top Domains
  'home.top_domains_breakdown': `WITH adx AS (
    SELECT website, SUM(COALESCE(revenue,0))::numeric AS adx_revenue
    FROM "AdReport" WHERE dataDate BETWEEN :from AND :to GROUP BY website
  ), offer AS (
    SELECT website, SUM(COALESCE(revenue,0))::numeric AS offer_revenue
    FROM "offer_revenue" WHERE dataDate BETWEEN :from AND :to GROUP BY website
  ), gc AS (
    SELECT website, SUM(COALESCE(cost,0))::numeric AS google_cost
    FROM "ad_costs" WHERE source='google' AND dataDate BETWEEN :from AND :to GROUP BY website
  ), bc AS (
    SELECT website, SUM(COALESCE(cost,0))::numeric AS bing_cost
    FROM "ad_costs" WHERE source='bing' AND dataDate BETWEEN :from AND :to GROUP BY website
  )
  SELECT COALESCE(adx.website, offer.website, gc.website, bc.website) AS website,
         COALESCE(adx.adx_revenue,0)   AS adx_revenue,
         COALESCE(offer.offer_revenue,0) AS offer_revenue,
         COALESCE(gc.google_cost,0)    AS google_cost,
         COALESCE(bc.bing_cost,0)      AS bing_cost
  FROM adx
  FULL OUTER JOIN offer USING (website)
  FULL OUTER JOIN gc USING (website)
  FULL OUTER JOIN bc USING (website)
  ORDER BY (COALESCE(adx_revenue,0) + COALESCE(offer_revenue,0)) DESC
  LIMIT 200;`,
  'report.kpi_series': `WITH rev AS (
    SELECT dataDate::date AS day, SUM(COALESCE(revenue,0))::numeric AS revenue
    FROM "AdReport"
    WHERE website = :site AND dataDate BETWEEN :from AND :to
    GROUP BY 1
  ), cost AS (
    SELECT dataDate::date AS day,
           SUM(COALESCE(cost,0))::numeric AS cost,
           SUM(COALESCE(clicks,0))::bigint AS clicks
    FROM "ad_costs"
    WHERE website = :site AND dataDate BETWEEN :from AND :to
    GROUP BY 1
  )
  SELECT COALESCE(r.day, c.day) AS day,
         COALESCE(r.revenue,0) - COALESCE(c.cost,0) AS profit,
         CASE WHEN COALESCE(c.cost,0)>0 THEN COALESCE(r.revenue,0)/COALESCE(c.cost,0)*100 ELSE NULL END AS roi,
         CASE WHEN COALESCE(c.clicks,0)>0 THEN COALESCE(c.cost,0)/NULLIF(COALESCE(c.clicks,0),0) ELSE NULL END AS cpc
  FROM rev r FULL OUTER JOIN cost c ON r.day = c.day
  ORDER BY 1;`
  ,
  'report.country_table_kpi': `WITH rev_country_day AS (
    SELECT dataDate::date AS day, country,
           SUM(COALESCE(revenue,0))::numeric AS revenue,
           SUM(COALESCE(clicks,0))::bigint AS clicks,
           SUM(COALESCE(impressions,0))::bigint AS impressions
    FROM "AdReport"
    WHERE website = :site AND dataDate BETWEEN :from AND :to
    GROUP BY 1, country
  ), rev_total_day AS (
    SELECT day, SUM(revenue)::numeric AS revenue_total FROM rev_country_day GROUP BY day
  ), cost_day AS (
    SELECT dataDate::date AS day, SUM(COALESCE(cost,0))::numeric AS cost
    FROM "ad_costs"
    WHERE website = :site AND dataDate BETWEEN :from AND :to
    GROUP BY 1
  ), dist AS (
    SELECT c.country, c.day, c.revenue, c.clicks, c.impressions, t.revenue_total, d.cost,
           CASE WHEN t.revenue_total>0 THEN (c.revenue / t.revenue_total) * COALESCE(d.cost,0) ELSE 0 END AS cost_alloc
    FROM rev_country_day c
    JOIN rev_total_day t ON t.day = c.day
    LEFT JOIN cost_day d ON d.day = c.day
  )
  SELECT country,
         SUM(impressions)::bigint AS impressions,
         SUM(clicks)::bigint AS clicks,
         CASE WHEN SUM(impressions)>0 THEN SUM(clicks)::numeric/SUM(impressions)*100 ELSE 0 END AS ctr,
         CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm,
         SUM(revenue)::numeric AS revenue,
         SUM(cost_alloc)::numeric AS cost,
         CASE WHEN SUM(clicks)>0 THEN SUM(cost_alloc)::numeric/NULLIF(SUM(clicks),0) ELSE NULL END AS cpc,
         CASE WHEN SUM(cost_alloc)>0 THEN SUM(revenue)::numeric/SUM(cost_alloc)*100 ELSE NULL END AS roi
  FROM dist
  GROUP BY country
  ORDER BY revenue DESC
  LIMIT 200;`,
  'report.device_table_kpi': `WITH rev_dev_day AS (
    SELECT dataDate::date AS day, device,
           SUM(COALESCE(revenue,0))::numeric AS revenue,
           SUM(COALESCE(clicks,0))::bigint AS clicks,
           SUM(COALESCE(impressions,0))::bigint AS impressions
    FROM "AdReport"
    WHERE website = :site AND dataDate BETWEEN :from AND :to
    GROUP BY 1, device
  ), rev_total_day AS (
    SELECT day, SUM(revenue)::numeric AS revenue_total FROM rev_dev_day GROUP BY day
  ), cost_day AS (
    SELECT dataDate::date AS day, SUM(COALESCE(cost,0))::numeric AS cost
    FROM "ad_costs"
    WHERE website = :site AND dataDate BETWEEN :from AND :to
    GROUP BY 1
  ), dist AS (
    SELECT d.device, d.day, d.revenue, d.clicks, d.impressions, t.revenue_total, c.cost,
           CASE WHEN t.revenue_total>0 THEN (d.revenue / t.revenue_total) * COALESCE(c.cost,0) ELSE 0 END AS cost_alloc
    FROM rev_dev_day d
    JOIN rev_total_day t ON t.day = d.day
    LEFT JOIN cost_day c ON c.day = d.day
  )
  SELECT device,
         SUM(impressions)::bigint AS impressions,
         SUM(clicks)::bigint AS clicks,
         CASE WHEN SUM(impressions)>0 THEN SUM(clicks)::numeric/SUM(impressions)*100 ELSE 0 END AS ctr,
         CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm,
         SUM(revenue)::numeric AS revenue,
         SUM(cost_alloc)::numeric AS cost,
         CASE WHEN SUM(clicks)>0 THEN SUM(cost_alloc)::numeric/NULLIF(SUM(clicks),0) ELSE NULL END AS cpc,
         CASE WHEN SUM(cost_alloc)>0 THEN SUM(revenue)::numeric/SUM(cost_alloc)*100 ELSE NULL END AS roi
  FROM dist
  GROUP BY device
  ORDER BY revenue DESC
  LIMIT 100;`,
  'report.browser_table_kpi': `WITH rev_bro_day AS (
    SELECT dataDate::date AS day, browser,
           SUM(COALESCE(revenue,0))::numeric AS revenue,
           SUM(COALESCE(clicks,0))::bigint AS clicks,
           SUM(COALESCE(impressions,0))::bigint AS impressions
    FROM "AdReport"
    WHERE website = :site AND dataDate BETWEEN :from AND :to
    GROUP BY 1, browser
  ), rev_total_day AS (
    SELECT day, SUM(revenue)::numeric AS revenue_total FROM rev_bro_day GROUP BY day
  ), cost_day AS (
    SELECT dataDate::date AS day, SUM(COALESCE(cost,0))::numeric AS cost
    FROM "ad_costs"
    WHERE website = :site AND dataDate BETWEEN :from AND :to
    GROUP BY 1
  ), dist AS (
    SELECT b.browser, b.day, b.revenue, b.clicks, b.impressions, t.revenue_total, c.cost,
           CASE WHEN t.revenue_total>0 THEN (b.revenue / t.revenue_total) * COALESCE(c.cost,0) ELSE 0 END AS cost_alloc
    FROM rev_bro_day b
    JOIN rev_total_day t ON t.day = b.day
    LEFT JOIN cost_day c ON c.day = b.day
  )
  SELECT browser,
         SUM(impressions)::bigint AS impressions,
         SUM(clicks)::bigint AS clicks,
         CASE WHEN SUM(impressions)>0 THEN SUM(clicks)::numeric/SUM(impressions)*100 ELSE 0 END AS ctr,
         CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm,
         SUM(revenue)::numeric AS revenue,
         SUM(cost_alloc)::numeric AS cost,
         CASE WHEN SUM(clicks)>0 THEN SUM(cost_alloc)::numeric/NULLIF(SUM(clicks),0) ELSE NULL END AS cpc,
         CASE WHEN SUM(cost_alloc)>0 THEN SUM(revenue)::numeric/SUM(cost_alloc)*100 ELSE NULL END AS roi
  FROM dist
  GROUP BY browser
  ORDER BY revenue DESC
  LIMIT 100;`,
  'report.adunit_table_kpi': `WITH rev_unit_day AS (
    SELECT dataDate::date AS day, adUnit,
           SUM(COALESCE(revenue,0))::numeric AS revenue,
           SUM(COALESCE(clicks,0))::bigint AS clicks,
           SUM(COALESCE(impressions,0))::bigint AS impressions
    FROM "AdReport"
    WHERE website = :site AND dataDate BETWEEN :from AND :to
    GROUP BY 1, adUnit
  ), rev_total_day AS (
    SELECT day, SUM(revenue)::numeric AS revenue_total FROM rev_unit_day GROUP BY day
  ), cost_day AS (
    SELECT dataDate::date AS day, SUM(COALESCE(cost,0))::numeric AS cost
    FROM "ad_costs"
    WHERE website = :site AND dataDate BETWEEN :from AND :to
    GROUP BY 1
  ), dist AS (
    SELECT u.adUnit, u.day, u.revenue, u.clicks, u.impressions, t.revenue_total, c.cost,
           CASE WHEN t.revenue_total>0 THEN (u.revenue / t.revenue_total) * COALESCE(c.cost,0) ELSE 0 END AS cost_alloc
    FROM rev_unit_day u
    JOIN rev_total_day t ON t.day = u.day
    LEFT JOIN cost_day c ON c.day = u.day
  )
  SELECT adUnit,
         SUM(impressions)::bigint AS impressions,
         SUM(clicks)::bigint AS clicks,
         CASE WHEN SUM(impressions)>0 THEN SUM(clicks)::numeric/SUM(impressions)*100 ELSE 0 END AS ctr,
         CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm,
         SUM(revenue)::numeric AS revenue,
         SUM(cost_alloc)::numeric AS cost,
         CASE WHEN SUM(clicks)>0 THEN SUM(cost_alloc)::numeric/NULLIF(SUM(clicks),0) ELSE NULL END AS cpc,
         CASE WHEN SUM(cost_alloc)>0 THEN SUM(revenue)::numeric/SUM(cost_alloc)*100 ELSE NULL END AS roi
  FROM dist
  GROUP BY adUnit
  ORDER BY revenue DESC
  LIMIT 100;`,
  'report.advertiser_table_kpi': `WITH rev_adv_day AS (
    SELECT dataDate::date AS day, advertiser,
           SUM(COALESCE(revenue,0))::numeric AS revenue,
           SUM(COALESCE(clicks,0))::bigint AS clicks,
           SUM(COALESCE(impressions,0))::bigint AS impressions
    FROM "AdReport"
    WHERE website = :site AND dataDate BETWEEN :from AND :to
    GROUP BY 1, advertiser
  ), rev_total_day AS (
    SELECT day, SUM(revenue)::numeric AS revenue_total FROM rev_adv_day GROUP BY day
  ), cost_day AS (
    SELECT dataDate::date AS day, SUM(COALESCE(cost,0))::numeric AS cost
    FROM "ad_costs"
    WHERE website = :site AND dataDate BETWEEN :from AND :to
    GROUP BY 1
  ), dist AS (
    SELECT a.advertiser, a.day, a.revenue, a.clicks, a.impressions, t.revenue_total, c.cost,
           CASE WHEN t.revenue_total>0 THEN (a.revenue / t.revenue_total) * COALESCE(c.cost,0) ELSE 0 END AS cost_alloc
    FROM rev_adv_day a
    JOIN rev_total_day t ON t.day = a.day
    LEFT JOIN cost_day c ON c.day = a.day
  )
  SELECT advertiser,
         SUM(impressions)::bigint AS impressions,
         SUM(clicks)::bigint AS clicks,
         CASE WHEN SUM(impressions)>0 THEN SUM(clicks)::numeric/SUM(impressions)*100 ELSE 0 END AS ctr,
         CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm,
         SUM(revenue)::numeric AS revenue,
         SUM(cost_alloc)::numeric AS cost,
         CASE WHEN SUM(clicks)>0 THEN SUM(cost_alloc)::numeric/NULLIF(SUM(clicks),0) ELSE NULL END AS cpc,
         CASE WHEN SUM(cost_alloc)>0 THEN SUM(revenue)::numeric/SUM(cost_alloc)*100 ELSE NULL END AS roi
  FROM dist
  GROUP BY advertiser
  ORDER BY revenue DESC
  LIMIT 100;`
}

async function seedChartQueries() {
  const existing = await prisma.chartQuery.findMany({ select: { chartKey: true } })
  const have = new Set(existing.map(x => x.chartKey))
  let created = 0
  for (const [key, sql] of Object.entries(DEFAULT_QUERIES)) {
    if (!have.has(key)) {
      await prisma.chartQuery.create({ data: { chartKey: key, sqlText: sql, enabled: true } })
      created++
    }
  }
  console.log(`[BOOTSTRAP] ChartQueries created: ${created}`)
}

async function optimize() {
  const sqls = [
    `CREATE INDEX IF NOT EXISTS adrep_brin_datadate ON "AdReport" USING brin ("dataDate");`,
    `CREATE INDEX IF NOT EXISTS adrep_idx_datadate_website ON "AdReport" ("dataDate","website");`,
    `CREATE INDEX IF NOT EXISTS adrep_idx_website_country ON "AdReport" ("website","country");`,
    `CREATE INDEX IF NOT EXISTS adrep_idx_country ON "AdReport" ("country");`,
    `CREATE INDEX IF NOT EXISTS adrep_idx_device ON "AdReport" ("device");`,
    `CREATE INDEX IF NOT EXISTS adrep_idx_adformat ON "AdReport" ("adFormat");`,
    `CREATE INDEX IF NOT EXISTS adrep_idx_advertiser ON "AdReport" ("advertiser");`,
  ]
  for (const s of sqls) {
    try { await prisma.$executeRawUnsafe(s); } catch (e) { console.warn('[BOOTSTRAP] optimize failed:', e.message) }
  }
  try { await prisma.$executeRawUnsafe('ANALYZE "AdReport";') } catch (e) { console.warn('[BOOTSTRAP] ANALYZE failed:', e.message) }

  if (process.env.PG_ENABLE_PARTITION === '1') {
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
END$$;`
    try { await prisma.$executeRawUnsafe(partitionSQL); } catch(e) { console.warn('[BOOTSTRAP] partition create warn:', e.message) }
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[BOOTSTRAP] Skip: no DATABASE_URL')
    return
  }
  if (process.env.DB_BOOTSTRAP === '0') {
    console.log('[BOOTSTRAP] Disabled by DB_BOOTSTRAP=0')
    return
  }
  await seedChartQueries()
  await optimize()
}

main().catch(e=>{ console.error('[BOOTSTRAP] error', e) }).finally(async ()=>{ await prisma.$disconnect() })
