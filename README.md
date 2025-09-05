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

### 生产环境变量

```env
NODE_ENV=production
NEXT_PUBLIC_DOMAIN=moretop10.com
NEXT_PUBLIC_DEPLOYMENT_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

### 域名配置

- 测试环境: localhost
- 生产环境: moretop10.com

注意：生产环境会自动从 moretop10.com 301重定向到 www.moretop10.com

## 性能特性

- 流式处理大文件上传
- 批量数据库插入
- 分页查询优化
- 响应式设计

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