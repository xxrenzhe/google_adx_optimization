#!/bin/sh
# 启动脚本 - 确保/data目录有正确权限

log() { echo "$(date +'%Y-%m-%dT%H:%M:%S%z') [$1] $2"; }
is_verbose() { [ "${BOOT_VERBOSE:-0}" = "1" ]; }

log BOOT "Starting Google ADX Optimization"
is_verbose && log BOOT "User=$(whoami) UID=$(id -u) GID=$(id -g)"

# 必须以root运行
if [ "$(id -u)" != "0" ]; then
    echo "ERROR: This script must be run as root"
    exit 1
fi

# 检查/data目录
if [ -d "/data" ]; then
    is_verbose && log FS "/data exists: $(ls -ld /data)"
    
    # 修复权限
    is_verbose && log FS "Fixing /data permissions"
    chmod 755 /data
    chown -R nextjs:nodejs /data
    is_verbose && log FS "Fixed perms: $(ls -ld /data)"
    
    # 创建子目录
    is_verbose && log FS "Creating subdirectories"
    mkdir -p /data/uploads /data/results /data/next-cache /data/.npm
    chmod 755 /data/uploads /data/results /data/next-cache /data/.npm
    chown -R nextjs:nodejs /data/uploads /data/results /data/next-cache /data/.npm
    
    is_verbose && log FS "Final perms: $(ls -ld /data)"
    is_verbose && log FS "uploads perms: $(ls -ld /data/uploads)"
    is_verbose && log FS "results perms: $(ls -ld /data/results)"
else
    log FS "ERROR: /data missing; please mount /data volume"
    exit 1
fi

log FS "Directory setup OK"

is_verbose && {
  log FS "Filesystem: $(df -T /data | tail -1)"
  mount | grep /data >/dev/null 2>&1 && log FS "Mount options captured"
}

is_verbose && log FS "Testing nextjs write access"
su-exec nextjs:nodejs touch /data/uploads/test_file_$$
if [ $? -eq 0 ]; then
    is_verbose && log FS "Write test OK"
    rm -f /data/uploads/test_file_$$
else
    log FS "ERROR: nextjs cannot write to /data/uploads — check storage configuration"
    exit 1
fi

is_verbose && log FS "Permission tests passed"

log APP "Starting Next.js as user 'nextjs'"

# 数据库初始化（按需）
if [ -n "$DATABASE_URL" ]; then
  if [ "${DB_BOOTSTRAP:-0}" = "1" ]; then
    log DB "Bootstrap enabled (DB_BOOTSTRAP=1)"
    # Optional: reset public schema if requested (DANGEROUS)
    if [ "${DB_RESET_PUBLIC:-0}" = "1" ]; then
      log DB "Resetting public schema (DB_RESET_PUBLIC=1)"
      su-exec nextjs:nodejs node -e '
        const { Client } = require("pg");
        (async () => {
          const url = process.env.DATABASE_URL; if (!url) { console.error("No DATABASE_URL"); process.exit(1) }
          const c = new Client({ connectionString: url });
          await c.connect();
          await c.query("DROP SCHEMA IF EXISTS public CASCADE;");
          await c.query("CREATE SCHEMA public;");
          await c.query("GRANT ALL ON SCHEMA public TO public;");
          await c.end();
          console.log("[DB] RESET done");
        })().catch(e => { console.error("[DB-RESET] failed:", e?.message || e); process.exit(1) })
      ' || log DB "Reset failed"
    fi
    is_verbose && { ls -la /app/prisma || true; ls -la /app/prisma/migrations || true; }
    MIGRATIONS_DIR="/app/prisma/migrations"
    if [ -d "$MIGRATIONS_DIR" ] && [ -n "$(ls -A "$MIGRATIONS_DIR" 2>/dev/null)" ]; then
      log DB "Running prisma migrate deploy"
      su-exec nextjs:nodejs node /app/node_modules/prisma/build/index.js migrate deploy --schema=/app/prisma/schema.prisma || log DB "migrate deploy failed"
    else
      log DB "No migrations; fallback to prisma db push (with --accept-data-loss)"
      PRISMA_FLAGS="--schema=/app/prisma/schema.prisma --skip-generate --accept-data-loss"
      su-exec nextjs:nodejs node /app/node_modules/prisma/build/index.js db push $PRISMA_FLAGS || log DB "db push failed"
    fi
    su-exec nextjs:nodejs node /app/scripts/bootstrap.js || log DB "bootstrap failed"
  else
    log DB "Bootstrap disabled (DB_BOOTSTRAP=0)"
  fi
else
  log DB "Skip DB steps (no DATABASE_URL)"
fi

exec su-exec nextjs:nodejs npm run start:prod
