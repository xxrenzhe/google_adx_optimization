# Google ADX优化系统 - 部署指南

## 概述
本文档详细说明了如何部署优化后的Google ADX系统，使其能够支持100万行数据处理。

## 部署前准备

### 1. 系统要求
- 容器环境：Docker
- 数据库：PostgreSQL 12+
- 缓存：Redis 6+
- 服务器配置：至少1C2G（推荐2C4G）

### 2. 依赖工具
- Git
- psql（PostgreSQL客户端）
- wget 或 curl

## 部署步骤

### 第一步：代码部署

1. **确保所有代码已提交**
```bash
git status
git add .
git commit -m "Optimize system for 1M row data processing"
git push origin main
```

2. **验证GitHub Actions构建**
   - 访问：https://github.com/xxrenzhe/google_adx_optimization/actions
   - 确认构建成功
   - 镜像标签：`ghcr.io/xxrenzhe/google_adx_optimization:prod-latest`

### 第二步：数据库优化

1. **运行数据库优化脚本**
```bash
# 在服务器上执行
./deploy-db-optimization.sh
```

2. **验证优化结果**
```bash
psql $DATABASE_URL -c "SELECT get_performance_stats();"
```

### 第三步：ClawCloud部署（含 DB_BOOTSTRAP 行为）

1. **登录ClawCloud控制台**
   - 访问：https://clawcloud.run
   - 进入容器管理

2. **更新容器配置**
```yaml
# 容器配置
image: ghcr.io/xxrenzhe/google_adx_optimization:prod-latest
ports:
  - "3000:3000"
environment:
  - NODE_ENV=production
  - DATABASE_URL=postgresql://postgres:w8mhnnqh@dbprovider.sg-members-1.clawcloudrun.com:32404/adx_optimization?directConnection=true
  - REDIS_URL=redis://default:9xdjb8nf@dbprovider.sg-members-1.clawcloudrun.com:32284
  # 首次部署/结构变更时临时开启，完成后改回 0 并再次发布
  - DB_BOOTSTRAP=1
  - CRON_SECRET=your-secret-key-here  # 生成一个随机字符串（可选，用于定时任务鉴权）
resources:
  limits:
    memory: "2Gi"
    cpu: "1000m"
```

3. **部署并启动容器（首次/变更部署）**
   - 点击"部署"按钮
   - 等待容器启动完成
   - 检查日志：
     - 若包含迁移：应看到 `prisma migrate deploy` 与 `bootstrap` 幂等执行
     - 若无迁移：应看到 `prisma db push` 回退执行与 `bootstrap`

4. **验证后回收 DB_BOOTSTRAP**
   - 将 `DB_BOOTSTRAP` 设置为 `0` 并再次发布（正常运行期间不改表）

### 第四步：配置定时任务

#### 方案A：使用Vercel Cron（推荐）

1. **在项目根目录创建 `vercel.json`**：
```json
{
  "crons": [
    {
      "path": "/api/data-cleanup",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cache-cleanup", 
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/db-maintenance",
      "schedule": "0 3 * * 0"
    }
  ]
}
```

2. **部署到Vercel**
```bash
npm i -g vercel
vercel --prod
```

#### 方案B：使用服务器Cron

1. **编辑crontab**
```bash
crontab -e
```

2. **添加以下任务**
```bash
# 数据清理（每天凌晨2点）
0 2 * * * curl -X POST https://www.moretop10.com/api/data-cleanup -H "Authorization: Bearer $CRON_SECRET"

# 缓存清理（每6小时）
0 */6 * * * curl -X POST https://www.moretop10.com/api/cache-cleanup -H "Authorization: Bearer $CRON_SECRET"

# 数据库维护（每周日凌晨3点）
0 3 * * 0 curl -X POST https://www.moretop10.com/api/db-maintenance -H "Authorization: Bearer $CRON_SECRET"
```

### 第五步：验证部署

1. **检查服务状态**
```bash
# 检查主页
curl -I https://www.moretop10.com

# 检查健康状态
curl https://www.moretop10.com/api/health
```

2. **功能测试**
   - 访问 https://www.moretop10.com
   - 上传测试文件
   - 查看数据分析结果
   - 验证数据独立性和清理功能

## 环境变量配置

### 生产环境变量（含 DB_BOOTSTRAP 建议）
```bash
# .env.production（精简）
NODE_ENV=production
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."           # 开启缓存时配置
DB_BOOTSTRAP=0                     # 默认 0；首次/变更部署时设为 1，完成后改回 0
# DB_ACCEPT_DATA_LOSS=1            # 仅在需要允许 db push 接受数据变更警告时开启（空库一般无需）
USE_PG_COPY=1                      # 可选：导入时使用 COPY 优化
CRON_SECRET="generate-a-random-string-here"  # 可选：定时任务鉴权
```

## 监控和维护

### 1. 性能监控
- 数据库查询时间
- Redis命中率
- API响应时间
- 内存使用情况

### 2. 日志检查
```bash
# 查看容器日志
docker logs -f container_name

# 检查错误日志
grep "ERROR" /var/log/app.log
```

### 3. 定期维护任务
- 每周检查数据库大小
- 每月检查索引性能
- 每季度清理旧数据

## 回滚方案

如果部署出现问题：

1. **快速回滚**
```bash
# 使用之前的镜像标签
docker run ghcr.io/xxrenzhe/google_adx_optimization:prod-previous
```

2. **数据库恢复**
```bash
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql
```

## 性能优化建议

### 1. 数据库层面
```postgresql
# postgresql.conf 优化
shared_buffers = 256MB
work_mem = 16MB
maintenance_work_mem = 128MB
effective_cache_size = 1GB
random_page_cost = 1.1
checkpoint_segments = 32
wal_buffers = 16MB
max_parallel_workers_per_gather = 4
```

### 2. Redis层面
```bash
# redis.conf 优化
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### 3. 应用层面
- 使用CDN加速静态资源
- 启用Gzip压缩
- 配置合理的缓存策略

## 故障排除

### 常见问题

1. **上传失败**
   - 检查文件大小限制
   - 确认磁盘空间充足
   - 查看容器日志

2. **数据库连接错误**
   - 验证连接字符串
   - 检查网络连通性
   - 确认数据库服务状态

3. **内存不足**
   - 增加容器内存限制
   - 优化批次大小
   - 清理无用数据

### 日志位置
- 应用日志：`/var/log/adx-app.log`
- Nginx日志：`/var/log/nginx/`
- 系统日志：`/var/log/syslog`

## 联系支持

如遇到问题，请提供：
1. 错误截图或日志
2. 操作步骤
3. 环境信息
4. 部署时间

---

**部署检查清单**
- [ ] 代码已推送到main分支
- [ ] GitHub Actions构建成功
- [ ] 数据库优化脚本已执行
- [ ] 容器已更新到最新镜像
- [ ] 环境变量已配置
- [ ] 定时任务已设置
- [ ] 健康检查通过
- [ ] 功能测试完成
- [ ] 备份文件已保存
