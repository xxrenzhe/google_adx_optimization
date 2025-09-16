# Google ADX 数据优化系统 — 需求说明 V2

本版本在现有项目基础上，明确数据库、页面、导入与查询等落地细节，兼容现有上传链路与大文件处理，新增首页/报告页 1:1 复刻，并形成从“数据库查询”驱动的通用图表体系（支持可编辑查询）。

## 进度更新（已完成/进行中）

- 已完成
  - PostgreSQL 单库方案落地；Prisma schema 扩展（AdReport 唯一键、Site、ChartQuery）。
  - CSV→DB 异步导入（批量 upsert，去重幂等），/upload 页面与“最近10条上传记录”。
  - 仅文件保留30天（/uploads、/results）；DB 长期保存。
  - 首页 `/` 与报告 `/report` 1:1 风格基础骨架（ApexCharts），所有图表数据来自数据库。
  - /analytics、/analytics-enhanced、/alerts、/predictive、/automation 拆分为独立页面（DB 数据源）。
  - 图表“可编辑查询”（ChartQueries + 只读 SQL 网关），/charts/edit 页面，且各页面卡片已集成“就地编辑”弹窗。
  - 站点列表来自 DB（Site 表），/report 左上角站点切换与 URL 同步。
  - UI 风格统一为 trk_ui（导航、卡片、工具条 TopFilterBar）。
  - 部署自动化：入口脚本集成 db push、ChartQueries 种子、索引/BRIN 优化（可选分区尝试）。
  - 可选高性能导入：AdReport 支持 `USE_PG_COPY=1` 走 COPY 导入；未启用则批量 upsert。
  - 多源扩展（基础版）：新增 OfferRevenue、YahooRevenue、AdCost 三张事实表及查询种子；
    - 首页：Benefit Summary/Proportion Of Income 自动叠加 Offer/Yahoo（存在数据时）；
    - 报告页：新增 KPI 卡片（Total Revenue/Cost/Profit/ROI/CPC）来自 DB 汇总。
  - 导入性能强化：Offer/Yahoo/Cost 已支持 `USE_PG_COPY=1` 走 COPY（失败自动回退批量 upsert）。
  - /upload UI 扩展：支持上传成本/Offer/Yahoo 文件；上传历史新增“类型/来源”字段展示。
  - 查询结果缓存与审计：`/api/charts`、`/api/report/summary` 增加 Redis 短期缓存；ChartQueries 编辑写入审计表（ChartQueryAudit）。
  - 报告页 KPI 拓展：新增 `report.kpi_series`（按日 Profit/ROI/CPC）并接入到 /report。
  - 分区脚本（可选）：提供一次性转换脚本（仅命令行执行，当前数据量不启用）。
  - 日期/筛选 1:1 复刻：统一采用扁平化弹出式日期组件（react-flatpickr），支持 Today/Yesterday/Last7/14/This/LastMonth 预设与 URL 同步；Compare 对比周期贯通首页/报告页主要时间序列。
  - 首页 KPI 卡片：新增 Today / Last 7 Days / Yesterday 收入卡片（ADX+Offer+Yahoo 合计）。
  - 主题与数值格式：ApexCharts 主题、颜色、网格与 tooltip 统一；表格金额/千分位/百分比格式化统一为产品规范。
  - 维度级 KPI 完善：在国家/设备基础上，新增浏览器/广告单元/广告客户 3 个维度的 KPI 表格（含分摊成本的 Cost/CPC/ROI），均可通过 ChartQueries 编辑。

- 进行中 / 待优化
  - PostgreSQL 分区（可选）：当前数据量不启用，未来增长后再评估（参见 docs/DB_Optimization_Postgres.md）。
  - 维度级 KPI（可选增强）：现已覆盖 国家/设备/浏览器/广告单元/广告客户；若需广告格式（adFormat）等更多细分维度，可按相同分摊策略或接入细粒度成本后快速扩展。
  - 1:1 视觉微调：整体已统一至 trk_ui；若需像素级完全一致，可根据最终视觉稿对字号/间距/hover/tooltip 细节继续微调。

## 已确认前提

- 数据库：仅使用 PostgreSQL（短期内不引入其他 OLAP 数据库）。
- 鉴权：暂不需要“登录/权限/菜单体系”等功能。
- 数据保留：仅文件保留最近 30 天；数据库数据长期保存（不做 TTL）。
- 图表库：使用 ApexCharts（前端采用 react-apexcharts）。
- UI 统一：旧首页各 Tab 拆为独立路由后，完全统一 files/trk_ui 的风格（导航、配色、卡片）。
- 报告页站点选择：来源于数据库存在的站点域名列表，无多租户隔离要求。
- 资源：容器资源从 1C2G 放宽到 2C4G。
- 兼容性：现有 /results JSON 无需回填数据库；未来新增功能均以“数据库为唯一查询源”。
- 未接入维度：图表“Benefit Summary”仅展示 ADX；“Proportion Of Income”显示“Only ADX”。
- 可扩展性：对缺失维度（如成本/Offer/Yahoo 等）留出扩展位，待库内存在数据后可快速接入。
- 采用建议：其他未特别指明事项，按本文件推荐方案执行。

## 数据模型（PostgreSQL）

> 目标：支持 GB 级事实数据的高效导入与聚合；优先兼容现有 Prisma `AdReport` 定义，逐步演进为“分区 + 覆盖索引”的事实表。

### 1. 事实表（沿用 AdReport，建议演进为分区表）

- 表：`AdReport`（已存在，Prisma 管理）。
- 关键字段（均已存在或可按映射填充）：
  - 维度：`dataDate (DATE)`, `website`, `country`, `adFormat`, `adUnit`, `advertiser`, `domain`, `device`, `browser`
  - 指标：`requests`, `impressions`, `clicks`, `ctr`, `ecpm`, `revenue`, `viewableImpressions`, `viewabilityRate`, `measurableImpressions`, `fillRate`
  - 元信息：`sessionId`, `uploadDate`
- 唯一性（去重与幂等）
  - 唯一约束（推荐新增 UNIQUE 索引）：
    - `(dataDate, website, country, device, browser, adFormat, adUnit, advertiser, domain)`
  - 导入策略：`INSERT ... ON CONFLICT (...) DO UPDATE`（以最新导入值覆盖，避免重复行）。
- 索引（建议新增或优化）
  - 常用组合：
    - `(dataDate, website)`、`(dataDate, website, country)`、`(website, country, dataDate)`
  - 单维度：`(website)`, `(country)`, `(device)`, `(adFormat)`, `(advertiser)`
  - 时间：`BRIN(dataDate)` 用于大表顺序扫描优化
- 分区（推荐）
  - 原生 RANGE 分区：以 `dataDate` 按月分区（如 `ad_report_2025_01`）。
  - 好处：提升写入性能、缩小索引、便于冷热数据管理。

### 2. 站点维表（列表用于 /report 切换）

- 表：`Sites`
  - 字段：`id SERIAL`, `domain TEXT UNIQUE`, `first_seen DATE`, `last_seen DATE`
  - 维护：导入时 `INSERT ... ON CONFLICT DO UPDATE last_seen = EXCLUDED.last_seen`；或周期任务从 `AdReport` 去重写入。

### 3. 图表查询配置（可编辑查询）

- 表：`ChartQueries`
  - 字段：
    - `chart_key TEXT PRIMARY KEY`（如 `home.benefit_summary`, `report.country_table`）
    - `sql_text TEXT`（仅允许 SELECT；使用命名参数如 `:from`, `:to`, `:site`）
    - `params JSONB`（参数 schema/默认值定义）
    - `enabled BOOLEAN DEFAULT TRUE`
    - `updated_at TIMESTAMPTZ`
  - 安全：服务端执行前做只读校验（拒绝 `;`, DML/DDL/DCL 关键字），参数白名单绑定。

## CSV → DB 导入（异步、幂等、可扩展）

### 动态字段映射

- 复用 `lib/file-processing.ts` 的中英列名映射与 CSV 行解析。
- 将解析后的标准字段直接落库（对应 `AdReport` 字段）。

### 导入流程

1) `/upload` 页上传 CSV → 保存到 `/uploads`（保留 30 天）。
2) 创建 `UploadSession` 记录（已存在 Prisma 模型），标记 `status=uploading`。
3) 后台 Worker（Node.js）异步读取文件：
   - 优先使用 `pg`+`COPY FROM STDIN` 或分批 `INSERT ... ON CONFLICT`（1000～10000/批）。
   - 写入 `AdReport`，并 Upsert 到 `Sites`。
4) 完成后更新 `UploadSession.status=completed`，记录 `recordCount`、`processedAt`。
5) 导入幂等：靠事实表唯一键与 `ON CONFLICT` 覆盖，避免重复。

### 文件清理（仅文件，30 天）

- 沿用现有清理 API/Job，将 `/uploads` 与 `/results` 的保留期统一设为 30 天（仅文件；DB 长期保存）。

## 页面与路由

### 1) 上传页 `/upload`

- 功能：
  - 上传 CSV（支持 200MB，动态映射校验），展示“历史 10 条上传记录”（读取 `UploadSession`）。
  - 触发异步导入 DB（状态轮询/进度）。
- API：
  - `POST /api/upload`（保存文件 + 建会话 + 入队导入）
  - `GET /api/uploads/history?limit=10`（最近 10 条 `UploadSession`）

### 2) 首页 `/`（1:1 复刻 files/trk_ui/index.html）

- 数据全部来自 DB（PostgreSQL）；默认 SQL 均可在 `ChartQueries` 中编辑：
  - Benefit Summary（日收益叠加图）：仅 ADX（来自 `AdReport` 按日聚合）；Offer/Yahoo 暂无 → 显示 “Only ADX”。
  - Proportion Of Income（收入占比）：仅 ADX → 标注 “Only ADX”。
  - 核心指标卡片：Revenue（可）、eCPM/CTR（可）；Cost/Profit/ROI（缺成本，暂隐藏或标注“未接入成本数据”）。
  - Top 域名表：Impressions/Clicks/CTR/eCPM/Revenue（可）；Cost/Profit/ROI/CPC/ARPU（缺，见“缺失提示”）。
- API：统一 `GET /api/charts?key=<chart_key>&from=...&to=...`（服务端读取 `ChartQueries.sql_text` 执行返回）。

### 3) 报告页 `/report`（1:1 复刻 files/trk_ui/report.html）

- 功能：单站点数据展现，支持 URL：`/report?sites=demo-site.com`。
- 数据：全部来自 DB；每个图表/表格均对应一条 `ChartQueries`。
- 站点切换：`GET /api/sites` 从 `Sites` 表返回域名列表。
- 可展示：
  - 时间序列（Revenue/eCPM/Clicks/Impressions）：可
  - 设备/浏览器分布：可
  - 国家明细表：Impr/Clicks/CTR/eCPM/Revenue +（按日分摊的）CPC/Cost/ROI（chart key: `report.country_table_kpi`）

### 4) 旧首页 Tab 拆分为独立路由

- `/analytics`、`/analytics-enhanced`、`/alerts`、`/predictive`、`/automation`
  - 数据来源统一改造为 DB（PostgreSQL）
  - UI 风格统一为 trk_ui
  - 若缺失维度（如成本/第三方来源），按“缺失提示”策略处理

## 图表依赖与“缺失提示”

> 原则：对每个图表标注所需字段/表；若数据暂缺，则给出明确原因与扩展位（允许编辑 SQL 以接入新事实表后立即生效）。

### 首页 /

- Benefit Summary（日收益叠加图）
  - 依赖：`AdReport(dataDate, revenue)`（ADX）；Offer/Yahoo（未来接入 `fact_offer`/`fact_yahoo`）
  - 提示：Only ADX（未接入 Offer/Yahoo）
- Proportion Of Income（收入占比）
  - 依赖：同上
  - 提示：Only ADX
- 指标卡片（Revenue/eCPM/CTR）
  - 依赖：`AdReport(revenue, impressions, clicks)`
- Cost/Profit/ROI/CPC/ARPU（暂缺）
  - 依赖：成本事实表（如 `google_costs`/`bing_costs`），用户/访问数据（ARPU）
  - 提示：缺少成本/用户维度，暂无法计算；可在“查询编辑”接入后启用
- Top 域名表
  - 依赖：`AdReport(website, impressions, clicks, revenue, ecpm)` + `ad_costs(website, cost, clicks)`
  - 已补充：按站点+日期聚合成本，新增 `cost/cpc/roi`（chart key: `home.top_domains_kpi`）

### 报告页 /report

- 时间序列（Revenue/eCPM/Clicks/Impr）
  - 依赖：`AdReport(dataDate, revenue, impressions, clicks)`
- 设备/浏览器分布
  - 依赖：`AdReport(device, browser, revenue, impressions, clicks)`
- 国家明细表
  - 依赖：`AdReport(country, impressions, clicks, revenue, ecpm)`
  - 补充：支持使用站点日成本按收入占比分摊的成本估算，计算 `CPC/Cost/ROI`（chart key: `report.country_table_kpi`）

- 浏览器/广告单元/广告客户明细表（均含分摊成本）
  - 浏览器（Browser）：`report.browser_table_kpi`
  - 广告单元（AdUnit）：`report.adunit_table_kpi`
  - 广告客户（Advertiser）：`report.advertiser_table_kpi`
  - 说明：成本按“站点-日期”聚合后按“维度日收入/当日总收入”比例分摊；如接入细粒度成本事实表可替换为真实聚合。

## 默认 SQL 模板（示例）

> 说明：以下示例用于初始化 `ChartQueries`。均为只读 SELECT；支持命名参数 `:from`, `:to`, `:site`。

- Home — Benefit Summary（仅 ADX）
```
SELECT dataDate::date AS day,
       SUM(revenue)::numeric AS adx_revenue
FROM   "AdReport"
WHERE  dataDate BETWEEN :from AND :to
GROUP  BY 1
ORDER  BY 1;
```

- Home — Top Domains（按收入）
```
SELECT website,
       SUM(impressions)::bigint AS impressions,
       SUM(clicks)::bigint      AS clicks,
       CASE WHEN SUM(impressions)>0 THEN SUM(clicks)::numeric/SUM(impressions)*100 ELSE 0 END AS ctr,
       CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm,
       SUM(revenue)::numeric AS revenue
FROM   "AdReport"
WHERE  dataDate BETWEEN :from AND :to
GROUP  BY website
ORDER  BY revenue DESC
LIMIT  50;
```

- Report — 站点时间序列
```
SELECT dataDate::date AS day,
       SUM(revenue)::numeric AS revenue,
       SUM(impressions)::bigint AS impressions,
       SUM(clicks)::bigint AS clicks,
       CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm
FROM   "AdReport"
WHERE  website = :site
  AND  dataDate BETWEEN :from AND :to
GROUP  BY 1
ORDER  BY 1;
```

- Report — 设备/浏览器分布
```
SELECT device, browser,
       SUM(revenue)::numeric AS revenue,
       SUM(impressions)::bigint AS impressions,
       SUM(clicks)::bigint AS clicks
FROM   "AdReport"
WHERE  website = :site
  AND  dataDate BETWEEN :from AND :to
GROUP  BY device, browser
ORDER  BY revenue DESC
LIMIT  50;
```

- Report — 国家明细表
```
SELECT country,
       SUM(impressions)::bigint AS impressions,
       SUM(clicks)::bigint AS clicks,
       CASE WHEN SUM(impressions)>0 THEN SUM(clicks)::numeric/SUM(impressions)*100 ELSE 0 END AS ctr,
       CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm,
       SUM(revenue)::numeric AS revenue
FROM   "AdReport"
WHERE  website = :site
  AND  dataDate BETWEEN :from AND :to
GROUP  BY country
ORDER  BY revenue DESC
LIMIT  200;
```

- Report — KPI Series（按日 Profit/ROI/CPC）
```
WITH rev AS (
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
ORDER BY 1;
```

- Report — 浏览器明细表（含分摊成本）
```
WITH rev_bro_day AS (
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
LIMIT 100;
```

> 缺失提示文案示例：
> - “缺少成本数据（google_cost/bing_cost），暂无法计算 Cost/CPC/Profit/ROI。请在‘查询编辑’中接入成本事实表后启用。”
> - “未接入 Offer/Yahoo 数据，当前仅展示 ADX。”

## 查询编辑（只读 SQL 网关）

- UI：每个图表提供“编辑查询”入口（弹窗/抽屉），展示当前 SQL 与参数；保存后写回 `ChartQueries`。
- 安全：
  - 服务端校验：仅允许单条 `SELECT`；禁止 `;`、禁止 DDL/DML/DCL 关键字（DROP/INSERT/UPDATE/DELETE/ALTER/GRANT 等）。
  - 参数：限定白名单（`:from`, `:to`, `:site` 等），服务端做类型校验与绑定。
  - 连接：只读角色（PostgreSQL 只读用户）。
- 容错：SQL 执行失败 → 前端展示错误提示，不影响页面其他图表。

## 性能与资源

- 容器 2C4G 基线：
  - 导入并发：1～2（避免与查询争用内存）。
  - 批量写入：1k/批 INSERT + ON CONFLICT；可通过 `USE_PG_COPY=1` 切换 COPY（AdReport/Offer/Yahoo/Cost 均支持）。
  - 索引/分区：部署引导中已自动创建常用索引与 BRIN；分区提供开关与脚本（参见 docs/DB_Optimization_Postgres.md）。
- 缓存（推荐）：Redis 用于查询结果短期缓存（60～300s）、导入队列与幂等锁（可选）。

## /upload 与 /report 的落地要点

- /upload：
  - 历史记录：`UploadSession` 最近 10 条（文件名、大小、上传/处理时间、状态、记录数、类型/来源）。
  - 动态映射：严格校验必需列（日期、网站）；列顺序可变；附加列忽略或记录。
  - 失败重试：保留会话与错误信息；允许重新导入（Upsert 覆盖）。
- /report：
  - 站点列表：`GET /api/sites` 返回 `Sites` 表全部域名，按 `last_seen` DESC。
  - URL 同步：`/report?sites=example.com&range=YYYY-MM-DD - YYYY-MM-DD`。

## 里程碑（建议）

1) Phase 1（导入与查询基线）
   - 新增 `/upload` 与导入 Worker（COPY/Batch Upsert）
   - 新增 `Sites`、`ChartQueries` 表；初始化默认 SQL 模板
   - 首页 `/` 与报告 `/report` 1:1 UI 骨架 + 可用图表（仅 ADX 数据）
   - [状态] 已完成（导入为批量 upsert，后续可切换 COPY；ChartQueries 种子与索引在部署流程自动运行）

2) Phase 2（风格统一与旧 Tab 拆分）
   - 旧首页 Tab 拆为独立路由，并改为 DB 查询源（已完成基础版）
   - 全局 UI 统一为 trk_ui 风格（已完成基础版）
   - [状态] 已完成基础版（已统一导航/卡片/工具条，持续细化视觉）

3) Phase 3（性能与治理）
   - PostgreSQL 分区/索引优化，添加 BRIN（常用索引与 BRIN 已自动创建；分区为一次性转换）
   - Redis 缓存（已完成，可选启用）
   - 查询编辑安全网关完善与审计日志（已完成）
   - [状态] 索引/BRIN、缓存与审计已完成；分区转换待选时机

4) Phase 4（扩展维度）
   - 可选接入成本事实表（Google/Bing）、Offer/Yahoo 收入表、用户/UV/PV 表
   - 完善 Profit/ROI/CPC/ARPU 等图表与列（按维度细化）
   - [状态] 基础版已接入 Offer/Yahoo/Cost 并完成按日 KPI；维度级 CPC/ROI/Profit 仍待补齐

---

本 V2 方案确保：
- 上传→异步导入→DB 聚合→ApexCharts 展示 的全链路闭环；
- 对缺失维度的图表留出扩展位，并提供“可编辑查询”以便随库表扩展快速上线；
- 在仅用 PostgreSQL 的前提下，通过分区+索引+COPY 提升性能，满足 GB 级数据与 2C4G 资源约束。
