数据库初始化（Prisma 同步与引导）

目标
- 按 docs/MustKnow.md 的两步发布流程，规范化数据库初始化，不在应用容器内长期执行结构变更；初始化仅在发布后一次性执行。

策略摘要（单一路径优先）
- 生产初始化统一使用一次性 Job：使用 `prisma migrate deploy`（迁移为权威）。
- 应用镜像：含完整 node_modules（包括 Prisma CLI），运行期默认不做 DB 引导（`DB_BOOTSTRAP=0`）。
- 缓存与运行写入落到持久卷 `/data`（`/data/next-cache`、`/data/.npm`），避免 Pod ephemeral 限额问题。

前置条件
- Kubernetes 已创建持久卷声明（PVC）：`adx-data`，并挂载到 `/data`。
- 数据库连接密钥（Secret）：`db-secret`，键 `DATABASE_URL`。

一次性初始化 Job（权威路径，若可用）
- 文件：`k8s/prisma-db-init.yaml`
- 行为：执行 `prisma migrate deploy`；成功后（若 `DB_BOOTSTRAP=1`）执行 `/app/scripts/bootstrap.js`。

执行步骤
1) 应用镜像构建与部署（参考 docs/MustKnow.md）
   - GitHub Actions 产出镜像：`ghcr.io/xxrenzhe/google_adx_optimization:prod-latest`
   - 应用 Deployment 默认设置：`DB_BOOTSTRAP=0`
2) 运行初始化 Job（一次性）
   - `kubectl apply -f k8s/prisma-db-init.yaml`
   - 观察日志：`kubectl logs -f job/prisma-db-init`
   - 成功后可删除 Job（支持自动 GC，或手动 `kubectl delete job prisma-db-init`）

空库/可清空库（强制重置，谨慎使用）
- 若确认 `DATABASE_URL` 指向的数据库为空或可清空，可使用“一键重置并初始化”的 Job：
  - `kubectl apply -f k8s/prisma-db-reset-and-init.yaml`
  - 该 Job 依次执行：
    1. `node /app/scripts/db-reset.js`（DROP SCHEMA public CASCADE; CREATE SCHEMA public;）
    2. `prisma migrate deploy`
    3. `node /app/scripts/bootstrap.js`
  - 日志：`kubectl logs -f job/prisma-db-reset-and-init`
  - 完成后删除 Job：`kubectl delete job prisma-db-reset-and-init`

常见情形与开关
- 生产长期运行：保持应用 Deployment 的 `DB_BOOTSTRAP=0`，避免每次重启修改 schema。

Entrypoint 模式（无法使用 CI Secret / kubectl 时）
- 在部署平台仅设置环境变量，无需进入容器或集群：
  - `DATABASE_URL`：数据库连接串（平台提供）
  - `DB_BOOTSTRAP=1`：首次部署/结构变更时开启
  - 可选 `PG_ENABLE_PARTITION=1`：需要按月分区时开启
- 容器启动时将自动执行：
  - `prisma migrate deploy`（仅当存在 `prisma/migrations`）
  - 若不存在迁移目录：回退执行 `prisma db push --skip-generate --accept-data-loss`
  - 完成后执行 `node /app/scripts/bootstrap.js`（索引/默认查询，幂等）
- 验证无误后，可将 `DB_BOOTSTRAP` 设回 `0`。即使保持为 `1`，migrate deploy 也会在无待应用迁移时快速退出。

验证项

应急选项（默认不随生产构建发布）
- 管理端 HTTP 初始化与软初始化代码路径已从默认构建中移除/隐藏。若需在自建分支开启，请参考变更历史自行恢复，务必在非生产环境验证并做好访问控制。

软初始化（DB_SOFT_INIT），仅兜底
- 默认不包含在生产构建中；如需在本地或演示环境启用，请在自建分支恢复相关代码。
- `/api/health` 返回 200
- `/api/sites` 可返回空数组（初始无站点时）
- `/api/chart-queries/seed` 可重复调用，确保 `chart_queries` 中存在默认查询
