# PostgreSQL 优化与分区建议（AdReport）

本项目短期仅使用 PostgreSQL。为支撑 GB 级数据与多维聚合，建议对事实表 `AdReport` 实施如下优化：

## 1. 分区（按月 RANGE）

> Prisma 暂不直接声明分区，可使用 SQL 迁移脚本；迁移后 Prisma 仍可正常读写。

```
-- 1) 重建为分区表（如已是大表，请评估停机窗口或创建新表后交换）
BEGIN;

CREATE TABLE IF NOT EXISTS public.ad_report_partitioned (
  LIKE public."AdReport" INCLUDING ALL
) PARTITION BY RANGE ("dataDate");

-- 将触发器/约束/索引按需迁移；并创建唯一约束（与 Prisma schema 一致）
ALTER TABLE public.ad_report_partitioned
  ADD CONSTRAINT adrep_unique UNIQUE ("dataDate","website","country","device","browser","adFormat","adUnit","advertiser","domain");

-- 创建月分区（示例 2025 年）
DO $$
DECLARE d date := date '2025-01-01';
BEGIN
  WHILE d < date '2026-01-01' LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.ad_report_%s PARTITION OF public.ad_report_partitioned FOR VALUES FROM (%L) TO (%L);',
      to_char(d,'YYYY_MM'), d, (d + interval '1 month')::date
    );
    d := (d + interval '1 month')::date;
  END LOOP;
END$$;

COMMIT;
```

> 将旧数据迁移至分区表，并在迁移完成后重命名交换：

```
INSERT INTO public.ad_report_partitioned SELECT * FROM public."AdReport";
ALTER TABLE public."AdReport" RENAME TO "AdReport_backup";
ALTER TABLE public.ad_report_partitioned RENAME TO "AdReport";
```

## 2. 索引

- 时间与范围扫描
```
-- BRIN 索引（适合顺序时间写入）
CREATE INDEX IF NOT EXISTS adrep_brin_datadate ON public."AdReport" USING brin ("dataDate");
```

- 常用组合（按查询需要选择）
```
CREATE INDEX IF NOT EXISTS adrep_idx_datadate_website ON public."AdReport" ("dataDate","website");
CREATE INDEX IF NOT EXISTS adrep_idx_website_country ON public."AdReport" ("website","country");
CREATE INDEX IF NOT EXISTS adrep_idx_country ON public."AdReport" ("country");
CREATE INDEX IF NOT EXISTS adrep_idx_device ON public."AdReport" ("device");
CREATE INDEX IF NOT EXISTS adrep_idx_adformat ON public."AdReport" ("adFormat");
CREATE INDEX IF NOT EXISTS adrep_idx_advertiser ON public."AdReport" ("advertiser");
```

## 3. 导入优化

- 优先使用 COPY FROM STDIN（或分批 1k-10k 行 INSERT ON CONFLICT）
- 关闭同步提交（会降低数据安全，评估场景）：`SET synchronous_commit TO off;`
- 合理设置 `maintenance_work_mem`、`shared_buffers` 等（需 DBA 支持）

## 4. 统计与VACUUM

- 导入大批量后：`ANALYZE public."AdReport";`
- 定期 Autovacuum 保持索引与统计信息健康

## 5. 只读角色（查询网关）

- 图表查询编辑功能建议使用只读用户连接（避免误操作）
- 严格限制仅连接 SELECT 权限

以上脚本与步骤，请在 DBA 或测试环境验证后再用于生产。

## 6. 回滚与状态检查

- 回滚脚本：`scripts/pg-partition-rollback.js`
  - 先将当前 `AdReport` 重命名为 `AdReport_partitioned_backup`
  - 将 `AdReport_backup` 重命名回 `AdReport`
  - 要求在转换时已保留 `AdReport_backup`（见转换脚本与 `scripts/pg-partition-convert.js`）
- 转换脚本：`scripts/pg-partition-convert.js`（支持环境变量 `ALLOW_PARTITION_CONVERSION=1` 时运行）
- 运行建议：
  - 低峰期执行转换或回滚
  - 预估数据迁移耗时，并在前后执行 `ANALYZE`
  - 做好备份与只读验证
