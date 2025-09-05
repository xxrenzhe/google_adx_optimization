# Google ADX 数据优化系统 - 需求文档 v1.0

## 核心需求

用户上传CSV文件，系统处理后展示数据表格和图表，帮助优化广告收入。

## 功能模块

### 1. 文件上传
- 支持CSV拖拽上传
- 文件大小限制：50MB
- 实时显示上传进度

### 2. 数据表格
- 展示所有CSV字段
- 支持分页（10/50/100条）
- 所有列可排序
- 支持搜索筛选

### 3. 计算指标
1. **填充率** = (请求总数 / 展示次数) × 100%
2. **ARPU** = 收入 / 5000 (假设DAU=5000)

### 4. 数据可视化
- 收入趋势图
- 国家/地区分布饼图
- 设备类型对比柱状图
- 填充率分布直方图

### 5. 决策提醒
- 低填充率警告
- 高价值网站推荐
- 异常数据提醒

## 技术方案

### 前端
- Next.js 14 (React)
- Tailwind CSS
- Recharts (图表)
- 原生文件上传（不用第三方库）

### 后端
- Next.js API Routes
- PostgreSQL
- Prisma ORM

### 数据表设计
```sql
CREATE TABLE ad_reports (
  id SERIAL PRIMARY KEY,
  upload_date TIMESTAMP DEFAULT NOW(),
  data_date DATE NOT NULL,
  website VARCHAR(255) NOT NULL,
  country VARCHAR(100),
  ad_format VARCHAR(100),
  ad_unit VARCHAR(255),
  advertiser VARCHAR(255),
  domain VARCHAR(255),
  device VARCHAR(100),
  browser VARCHAR(100),
  requests BIGINT,
  impressions BIGINT,
  clicks BIGINT,
  ctr DECIMAL(10, 6),
  ecpm DECIMAL(10, 4),
  revenue DECIMAL(15, 6),
  viewable_impressions BIGINT,
  viewability_rate DECIMAL(10, 6),
  measurable_impressions BIGINT,
  fill_rate DECIMAL(10, 4),
  arpu DECIMAL(15, 6)
);

CREATE INDEX idx_data_date ON ad_reports(data_date);
CREATE INDEX idx_website ON ad_reports(website);
CREATE INDEX idx_country ON ad_reports(country);
```

## API设计
```
POST /api/upload - 文件上传和解析
GET /api/data - 获取表格数据
GET /api/analytics - 获取分析数据
```

## 实现计划

### 第1周：基础功能
- 文件上传
- CSV解析
- 数据存储

### 第2周：表格展示
- 数据列表
- 分页排序
- 搜索功能

### 第3周：图表展示
- 基础图表
- 数据聚合
- 交互功能

### 第4周：优化建议
- 算法实现
- 性能优化
- 测试部署

## 性能要求
- 10万条数据导入 < 30秒
- 查询响应 < 1秒
- 支持100并发用户

## 部署说明
- 使用GitHub Action构建Docker镜像
- 推送到main分支自动构建production镜像
- 标签：ghcr.io/xxrenzhe/google_adx_optimization:prod-latest
- 生产域名：moretop10.com