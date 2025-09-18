/*
  运行方式：
  - npm run charts:seed
  或
  - ./node_modules/.bin/ts-node scripts/seed-chart-queries.ts

  说明：仅 seed 首页依赖的图表查询 key，避免引入 Next 路由依赖，直接使用 Prisma upsert。
*/

import { prisma } from '../lib/prisma-extended'

const defaults: Record<string, string> = {
  // Home KPI tiles（可编辑）
  'home.kpi.today': `SELECT 
    COALESCE((SELECT SUM(revenue)::numeric FROM "AdReport" WHERE "dataDate"::date = CURRENT_DATE),0) +
    COALESCE((SELECT SUM(revenue)::numeric FROM "offer_revenue" WHERE "dataDate"::date = CURRENT_DATE),0) +
    COALESCE((SELECT SUM(revenue)::numeric FROM "yahoo_revenue" WHERE "dataDate"::date = CURRENT_DATE),0) AS v;`,
  'home.kpi.last7': `SELECT 
    COALESCE((SELECT SUM(revenue)::numeric FROM "AdReport" WHERE "dataDate" BETWEEN CURRENT_DATE - INTERVAL '6 day' AND CURRENT_DATE),0) +
    COALESCE((SELECT SUM(revenue)::numeric FROM "offer_revenue" WHERE "dataDate" BETWEEN CURRENT_DATE - INTERVAL '6 day' AND CURRENT_DATE),0) +
    COALESCE((SELECT SUM(revenue)::numeric FROM "yahoo_revenue" WHERE "dataDate" BETWEEN CURRENT_DATE - INTERVAL '6 day' AND CURRENT_DATE),0) AS v;`,
  'home.kpi.yesterday': `SELECT 
    COALESCE((SELECT SUM(revenue)::numeric FROM "AdReport" WHERE "dataDate"::date = CURRENT_DATE - INTERVAL '1 day'),0) +
    COALESCE((SELECT SUM(revenue)::numeric FROM "offer_revenue" WHERE "dataDate"::date = CURRENT_DATE - INTERVAL '1 day'),0) +
    COALESCE((SELECT SUM(revenue)::numeric FROM "yahoo_revenue" WHERE "dataDate"::date = CURRENT_DATE - INTERVAL '1 day'),0) AS v;`,
  // Home: ADX revenue by day
  'home.benefit_summary': `SELECT "dataDate"::date AS day, SUM(revenue)::numeric AS revenue FROM "AdReport" WHERE "dataDate" BETWEEN :from AND :to GROUP BY 1 ORDER BY 1;`,
  // Home: simple top domains (no cost)
  'home.top_domains': `SELECT website, SUM(impressions)::bigint AS impressions, SUM(clicks)::bigint AS clicks, CASE WHEN SUM(impressions)>0 THEN SUM(clicks)::numeric/SUM(impressions)*100 ELSE 0 END AS ctr, CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm, SUM(revenue)::numeric AS revenue FROM "AdReport" WHERE "dataDate" BETWEEN :from AND :to GROUP BY website ORDER BY revenue DESC LIMIT 50;`,
  // Home: Offer/Yahoo series（可选表）
  'home.offer_by_day': `SELECT "dataDate"::date AS day, SUM(revenue)::numeric AS revenue FROM "offer_revenue" WHERE "dataDate" BETWEEN :from AND :to GROUP BY 1 ORDER BY 1;`,
  'home.yahoo_by_day': `SELECT "dataDate"::date AS day, SUM(revenue)::numeric AS revenue FROM "yahoo_revenue" WHERE "dataDate" BETWEEN :from AND :to GROUP BY 1 ORDER BY 1;`,
  // Home: Classified Advertiser（按广告主聚合）
  'home.classified_advertiser': `SELECT advertiser, SUM(COALESCE(revenue,0))::numeric AS revenue, SUM(COALESCE(impressions,0))::bigint AS impressions, SUM(COALESCE(clicks,0))::bigint AS clicks, CASE WHEN SUM(COALESCE(impressions,0))>0 THEN SUM(COALESCE(revenue,0))::numeric/SUM(COALESCE(impressions,0))::numeric*1000 ELSE 0 END AS ecpm FROM "AdReport" WHERE "dataDate" BETWEEN :from AND :to GROUP BY advertiser ORDER BY revenue DESC LIMIT 12;`,
  // Home: Top Domains breakdown（ADX/Offer revenue 与 Google/Bing 成本）
  'home.top_domains_breakdown': `WITH adx AS (
    SELECT website, SUM(COALESCE(revenue,0))::numeric AS adx_revenue
    FROM "AdReport" WHERE "dataDate" BETWEEN :from AND :to GROUP BY website
  ), offer AS (
    SELECT website, SUM(COALESCE(revenue,0))::numeric AS offer_revenue
    FROM "offer_revenue" WHERE "dataDate" BETWEEN :from AND :to GROUP BY website
  ), gc AS (
    SELECT website, SUM(COALESCE(cost,0))::numeric AS google_cost
    FROM "ad_costs" WHERE source='google' AND "dataDate" BETWEEN :from AND :to GROUP BY website
  ), bc AS (
    SELECT website, SUM(COALESCE(cost,0))::numeric AS bing_cost
    FROM "ad_costs" WHERE source='bing' AND "dataDate" BETWEEN :from AND :to GROUP BY website
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
  // Home: Top Domains KPI（含成本/ROI/CPC）
  'home.top_domains_kpi': `WITH rev_site_day AS (
    SELECT "dataDate"::date AS day, website,
           SUM(COALESCE(revenue,0))::numeric AS revenue,
           SUM(COALESCE(impressions,0))::bigint AS impressions,
           SUM(COALESCE(clicks,0))::bigint AS clicks
    FROM "AdReport"
    WHERE "dataDate" BETWEEN :from AND :to
    GROUP BY 1, website
  ), cost_site_day AS (
    SELECT "dataDate"::date AS day, website,
           SUM(COALESCE(cost,0))::numeric AS cost,
           SUM(COALESCE(clicks,0))::bigint AS paid_clicks
    FROM "ad_costs"
    WHERE "dataDate" BETWEEN :from AND :to
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
  LIMIT 50;`
  ,
  // Report: main time series for selected site
  'report.timeseries': `SELECT "dataDate"::date AS day,
    SUM(revenue)::numeric AS revenue,
    SUM(impressions)::bigint AS impressions,
    SUM(clicks)::bigint AS clicks,
    CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm
  FROM "AdReport"
  WHERE website = :site AND "dataDate" BETWEEN :from AND :to
  GROUP BY 1 ORDER BY 1;`,
  // Report: device-browser matrix (Only ADX)
  'report.device_browser': `SELECT device, browser,
    SUM(revenue)::numeric AS revenue,
    SUM(impressions)::bigint AS impressions,
    SUM(clicks)::bigint AS clicks
  FROM "AdReport"
  WHERE website = :site AND "dataDate" BETWEEN :from AND :to
  GROUP BY 1,2 ORDER BY revenue DESC LIMIT 100;`,
  // Report: eCPM 独立时序
  'report.ecpm_series': `SELECT "dataDate"::date AS day,
    CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/NULLIF(SUM(impressions),0)*1000 ELSE 0 END AS ecpm
  FROM "AdReport" WHERE website = :site AND "dataDate" BETWEEN :from AND :to GROUP BY 1 ORDER BY 1;`,
  // Report: CPC（Google/Bing）
  'report.cpc_series': `SELECT "dataDate"::date AS day, LOWER(source) AS source,
    CASE WHEN SUM(clicks)>0 THEN SUM(cost)::numeric/NULLIF(SUM(clicks),0) ELSE NULL END AS cpc
  FROM "ad_costs" WHERE website = :site AND "dataDate" BETWEEN :from AND :to GROUP BY 1,2 ORDER BY 1;`,
  // Report: KPI series by day (profit/roi/cpc)
  'report.kpi_series': `WITH rev AS (
    SELECT "dataDate"::date AS day, SUM(COALESCE(revenue,0))::numeric AS revenue
    FROM "AdReport" WHERE website = :site AND "dataDate" BETWEEN :from AND :to GROUP BY 1
  ), cost AS (
    SELECT "dataDate"::date AS day, SUM(COALESCE(cost,0))::numeric AS cost, SUM(COALESCE(clicks,0))::bigint AS clicks
    FROM "ad_costs" WHERE website = :site AND "dataDate" BETWEEN :from AND :to GROUP BY 1
  )
  SELECT COALESCE(r.day, c.day) AS day,
    COALESCE(r.revenue,0) - COALESCE(c.cost,0) AS profit,
    CASE WHEN COALESCE(c.cost,0)>0 THEN COALESCE(r.revenue,0)/COALESCE(c.cost,0)*100 ELSE NULL END AS roi,
    CASE WHEN COALESCE(c.clicks,0)>0 THEN COALESCE(c.cost,0)/NULLIF(COALESCE(c.clicks,0),0) ELSE NULL END AS cpc
  FROM rev r FULL OUTER JOIN cost c ON r.day = c.day
  ORDER BY 1;`,
  // Report: country table (allocated cost)
  'report.country_table_kpi': `WITH rev_country_day AS (
    SELECT "dataDate"::date AS day, country,
      SUM(COALESCE(revenue,0))::numeric AS revenue,
      SUM(COALESCE(clicks,0))::bigint AS clicks,
      SUM(COALESCE(impressions,0))::bigint AS impressions
    FROM "AdReport" WHERE website = :site AND "dataDate" BETWEEN :from AND :to GROUP BY 1, country
  ), rev_total_day AS (
    SELECT day, SUM(revenue)::numeric AS revenue_total FROM rev_country_day GROUP BY day
  ), cost_day AS (
    SELECT "dataDate"::date AS day, SUM(COALESCE(cost,0))::numeric AS cost
    FROM "ad_costs" WHERE website = :site AND "dataDate" BETWEEN :from AND :to GROUP BY 1
  ), dist AS (
    SELECT c.country, c.day, c.revenue, c.clicks, c.impressions, t.revenue_total, d.cost,
      CASE WHEN t.revenue_total>0 THEN (c.revenue / t.revenue_total) * COALESCE(d.cost,0) ELSE 0 END AS cost_alloc
    FROM rev_country_day c JOIN rev_total_day t ON t.day = c.day LEFT JOIN cost_day d ON d.day = c.day
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
  FROM dist GROUP BY country ORDER BY revenue DESC LIMIT 200;`,
  // Report: device table (allocated cost)
  'report.device_table_kpi': `WITH rev_dev_day AS (
    SELECT "dataDate"::date AS day, device,
      SUM(COALESCE(revenue,0))::numeric AS revenue,
      SUM(COALESCE(clicks,0))::bigint AS clicks,
      SUM(COALESCE(impressions,0))::bigint AS impressions
    FROM "AdReport" WHERE website = :site AND "dataDate" BETWEEN :from AND :to GROUP BY 1, device
  ), rev_total_day AS (
    SELECT day, SUM(revenue)::numeric AS revenue_total FROM rev_dev_day GROUP BY day
  ), cost_day AS (
    SELECT "dataDate"::date AS day, SUM(COALESCE(cost,0))::numeric AS cost
    FROM "ad_costs" WHERE website = :site AND "dataDate" BETWEEN :from AND :to GROUP BY 1
  ), dist AS (
    SELECT d.device, d.day, d.revenue, d.clicks, d.impressions, t.revenue_total, c.cost,
      CASE WHEN t.revenue_total>0 THEN (d.revenue / t.revenue_total) * COALESCE(c.cost,0) ELSE 0 END AS cost_alloc
    FROM rev_dev_day d JOIN rev_total_day t ON t.day = d.day LEFT JOIN cost_day c ON c.day = d.day
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
  FROM dist GROUP BY device ORDER BY revenue DESC LIMIT 100;`,
  // Report: browser table (allocated cost)
  'report.browser_table_kpi': `WITH rev_bro_day AS (
    SELECT "dataDate"::date AS day, browser,
      SUM(COALESCE(revenue,0))::numeric AS revenue,
      SUM(COALESCE(clicks,0))::bigint AS clicks,
      SUM(COALESCE(impressions,0))::bigint AS impressions
    FROM "AdReport" WHERE website = :site AND "dataDate" BETWEEN :from AND :to GROUP BY 1, browser
  ), rev_total_day AS (
    SELECT day, SUM(revenue)::numeric AS revenue_total FROM rev_bro_day GROUP BY day
  ), cost_day AS (
    SELECT "dataDate"::date AS day, SUM(COALESCE(cost,0))::numeric AS cost
    FROM "ad_costs" WHERE website = :site AND "dataDate" BETWEEN :from AND :to GROUP BY 1
  ), dist AS (
    SELECT b.browser, b.day, b.revenue, b.clicks, b.impressions, t.revenue_total, c.cost,
      CASE WHEN t.revenue_total>0 THEN (b.revenue / t.revenue_total) * COALESCE(c.cost,0) ELSE 0 END AS cost_alloc
    FROM rev_bro_day b JOIN rev_total_day t ON t.day = b.day LEFT JOIN cost_day c ON c.day = b.day
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
  FROM dist GROUP BY browser ORDER BY revenue DESC LIMIT 100;`,
  // Report: adunit table (allocated cost)
  'report.adunit_table_kpi': `WITH rev_unit_day AS (
    SELECT "dataDate"::date AS day, "adUnit",
      SUM(COALESCE(revenue,0))::numeric AS revenue,
      SUM(COALESCE(clicks,0))::bigint AS clicks,
      SUM(COALESCE(impressions,0))::bigint AS impressions
    FROM "AdReport" WHERE website = :site AND "dataDate" BETWEEN :from AND :to GROUP BY 1, "adUnit"
  ), rev_total_day AS (
    SELECT day, SUM(revenue)::numeric AS revenue_total FROM rev_unit_day GROUP BY day
  ), cost_day AS (
    SELECT "dataDate"::date AS day, SUM(COALESCE(cost,0))::numeric AS cost
    FROM "ad_costs" WHERE website = :site AND "dataDate" BETWEEN :from AND :to GROUP BY 1
  ), dist AS (
    SELECT u."adUnit", u.day, u.revenue, u.clicks, u.impressions, t.revenue_total, c.cost,
      CASE WHEN t.revenue_total>0 THEN (u.revenue / t.revenue_total) * COALESCE(c.cost,0) ELSE 0 END AS cost_alloc
    FROM rev_unit_day u JOIN rev_total_day t ON t.day = u.day LEFT JOIN cost_day c ON c.day = u.day
  )
  SELECT "adUnit",
    SUM(impressions)::bigint AS impressions,
    SUM(clicks)::bigint AS clicks,
    CASE WHEN SUM(impressions)>0 THEN SUM(clicks)::numeric/SUM(impressions)*100 ELSE 0 END AS ctr,
    CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm,
    SUM(revenue)::numeric AS revenue,
    SUM(cost_alloc)::numeric AS cost,
    CASE WHEN SUM(clicks)>0 THEN SUM(cost_alloc)::numeric/NULLIF(SUM(clicks),0) ELSE NULL END AS cpc,
    CASE WHEN SUM(cost_alloc)>0 THEN SUM(revenue)::numeric/SUM(cost_alloc)*100 ELSE NULL END AS roi
  FROM dist GROUP BY "adUnit" ORDER BY revenue DESC LIMIT 100;`,
  // Report: advertiser table (allocated cost)
  'report.advertiser_table_kpi': `WITH rev_adv_day AS (
    SELECT "dataDate"::date AS day, advertiser,
      SUM(COALESCE(revenue,0))::numeric AS revenue,
      SUM(COALESCE(clicks,0))::bigint AS clicks,
      SUM(COALESCE(impressions,0))::bigint AS impressions
    FROM "AdReport" WHERE website = :site AND "dataDate" BETWEEN :from AND :to GROUP BY 1, advertiser
  ), rev_total_day AS (
    SELECT day, SUM(revenue)::numeric AS revenue_total FROM rev_adv_day GROUP BY day
  ), cost_day AS (
    SELECT "dataDate"::date AS day, SUM(COALESCE(cost,0))::numeric AS cost
    FROM "ad_costs" WHERE website = :site AND "dataDate" BETWEEN :from AND :to GROUP BY 1
  ), dist AS (
    SELECT a.advertiser, a.day, a.revenue, a.clicks, a.impressions, t.revenue_total, c.cost,
      CASE WHEN t.revenue_total>0 THEN (a.revenue / t.revenue_total) * COALESCE(c.cost,0) ELSE 0 END AS cost_alloc
    FROM rev_adv_day a JOIN rev_total_day t ON t.day = a.day LEFT JOIN cost_day c ON c.day = a.day
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
  FROM dist GROUP BY advertiser ORDER BY revenue DESC LIMIT 100;`
}

async function main() {
  let ok = 0
  for (const [chartKey, sqlText] of Object.entries(defaults)) {
    await (prisma as any).chartQuery.upsert({
      where: { chartKey },
      update: { sqlText, enabled: true },
      create: { chartKey, sqlText, enabled: true }
    })
    ok++
  }
  console.log(`[charts:seed] ok, count=${ok}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error('[charts:seed] error:', e); prisma.$disconnect(); process.exit(1) })
