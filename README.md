# Google ADX Optimization System

一个用于优化Google ADX广告收入的数据分析系统。

## 功能特性

- 📊 CSV文件上传和解析
- 📈 数据可视化图表
- 🔍 强大的数据表格（分页、排序、搜索）
- 💡 智能决策提醒
- 🚀 高性能处理（支持50MB文件）

## 技术栈

- **前端**: Next.js 14, React, Tailwind CSS
- **后端**: Next.js API Routes
- **数据库**: PostgreSQL
- **ORM**: Prisma
- **图表**: Recharts

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.local` 文件并配置数据库连接：

```bash
cp .env.local.example .env.local
```

### 生成Prisma客户端

```bash
npm run db:generate
```

### 推送数据库结构

```bash
npm run db:push
```

### 运行开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## 项目结构

```
app/
├── api/
│   ├── analytics/    # 分析数据API
│   ├── data/         # 表格数据API
│   └── upload/       # 文件上传API
├── globals.css       # 全局样式
├── layout.tsx        # 根布局
└── page.tsx          # 主页面
components/
├── analytics.tsx     # 分析图表组件
├── data-table.tsx    # 数据表格组件
└── upload.tsx        # 文件上传组件
lib/
└── prisma.ts         # Prisma客户端配置
prisma/
└── schema.prisma     # 数据库模型
```

## CSV格式要求

文件必须包含以下列：

- **必需**: Date, Website
- **可选**: Country, Device, Ad Format, Requests, Impressions, Clicks, Revenue等

## 部署

### Docker部署

项目配置了Docker支持，可以构建容器镜像：

```bash
docker build -t google-adx-optimization .
```

### 自动部署

推送到main分支会自动构建production镜像并推送到GitHub Container Registry。

镜像标签: `ghcr.io/xxrenzhe/google_adx_optimization:prod-latest`

## 环境配置

### 生产环境变量（精简版）

```env
# 必需
NODE_ENV=production
DATABASE_URL=postgresql://...

# 可选
REDIS_URL=redis://...        # 开启缓存时设置
DB_BOOTSTRAP=0               # 是否在启动时自动播种/索引优化（生产建议 0）
USE_PG_COPY=1                # 导入时使用 COPY 优化（可选）
# PORT=3000                  # 如需自定义端口
```

### 域名配置

- 测试环境: localhost
- 生产环境: moretop10.com

注意：生产环境会自动从 moretop10.com 301 重定向到 www.moretop10.com（由 DNS/CloudFlare 实现，应用层无需处理）

## 性能特性

- 流式处理大文件上传
- 批量数据库插入
- 分页查询优化
- 响应式设计

## 部署时数据库自动化（DB_BOOTSTRAP 默认行为）

容器启动时（entrypoint.sh）不默认改动数据库结构。通过环境变量控制：

- `DB_BOOTSTRAP=0`（默认，生产建议）：不执行任何 schema 同步，仅启动应用。
- `DB_BOOTSTRAP=1`（仅在首次部署或结构变更时开启）：
  - 若存在 `prisma/migrations`：执行 `prisma migrate deploy` 同步结构；
  - 否则回退执行 `prisma db push --skip-generate --accept-data-loss`；
  - 随后执行 `node scripts/bootstrap.js`（幂等）：创建缺失的 ChartQueries、追加常用索引/BRIN，并执行 ANALYZE；
  - 验证无误后，将 `DB_BOOTSTRAP` 还原为 `0` 再次发布。

说明：schema 变更应通过 Prisma 迁移（migrations）管理；`migrate deploy` 在无待应用迁移时会快速退出，不影响启动时延。

可选：设置 `USE_PG_COPY=1` 启用 COPY 导入（高吞吐），否则默认批量 INSERT + ON CONFLICT。

## 容器联调（连接外部数据库）

使用根目录的 compose 文件启动应用（只包含 APP，不包含 DB）：

1) 在项目根目录创建 `.env` 并配置外部数据库（以及可选 Redis）：
```
DATABASE_URL=postgresql://<user>:<pass>@<host>:<port>/<db>?schema=public
REDIS_URL=redis://<user>:<pass>@<host>:<port>
DB_BOOTSTRAP=0
USE_PG_COPY=1
```

2) 启动应用容器（自动安装依赖、构建、健康检查）：
```
docker compose up --build
```

3) 待容器健康后，运行冒烟测试：
```
HOST=localhost PORT=3000 sh scripts/smoke.sh
```

备注：生产镜像包含 HEALTHCHECK，通过 `/api/health` 检测服务状态。

## V2 更新摘要（与 docs/Requirements_V2.md 对齐）

- 上传类型拓展：/upload 页面支持 ADX、Offer、Yahoo、成本四类上传；历史记录新增类型/来源。
- 新增 API：`GET /api/uploads/history?limit=10` 获取最近上传；`/api/upload-offer`、`/api/upload-yahoo`、`/api/upload-costs` 分别导入对应事实表。
- 高性能导入：三类扩展导入均支持 `USE_PG_COPY=1` 走 COPY；失败自动降级批量 upsert。
- 可编辑查询：ChartQueries 支持 SQL 模板（:from/:to/:site），并记录到 `chart_query_audits` 审计表。
- 查询缓存：`/api/charts` 与 `/api/report/summary` 接口结果使用 Redis 短期缓存（120s）。
- 指标补齐：/report 新增 “Profit/ROI/CPC 按日” 曲线（`report.kpi_series`）。
  同时补齐：
  - 首页 Top Domains 含 Cost/CPC/ROI（`home.top_domains_kpi`）
  - 报表 Top Countries/Devices 含分摊成本的 Cost/CPC/ROI（`report.country_table_kpi`、`report.device_table_kpi`）

## 运维建议

- 当前数据量较小，按 BRIN + 常用组合索引即可满足查询性能，无需启用表分区转换。
- 若未来数据量显著增长，再评估启用分区脚本（命令行执行，非 Web 接口），详见 `docs/DB_Optimization_Postgres.md`。

## 开发命令

```bash
# 开发
npm run dev

# 构建
npm run build

# 启动生产服务器
npm start

# 代码检查
npm run lint

# 数据库相关
npm run db:generate  # 生成Prisma客户端
npm run db:push      # 推送schema到数据库
npm run db:migrate   # 运行迁移
```

## 许可证

MIT License
