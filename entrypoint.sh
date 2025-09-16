#!/bin/sh
# 启动脚本 - 确保/data目录有正确权限

echo "Starting Google ADX Optimization..."
echo "Current user: $(whoami)"
echo "Current UID: $(id -u)"
echo "Current GID: $(id -g)"

# 必须以root运行
if [ "$(id -u)" != "0" ]; then
    echo "ERROR: This script must be run as root"
    exit 1
fi

# 检查/data目录
if [ -d "/data" ]; then
    echo "/data directory exists"
    echo "/data permissions: $(ls -ld /data)"
    
    # 修复权限
    echo "Fixing /data permissions..."
    chmod 755 /data
    chown -R nextjs:nodejs /data
    echo "Fixed /data permissions: $(ls -ld /data)"
    
    # 创建子目录
    echo "Creating subdirectories..."
    mkdir -p /data/uploads /data/results
    chmod 755 /data/uploads /data/results
    chown -R nextjs:nodejs /data/uploads /data/results
    
    echo "Final /data permissions: $(ls -ld /data)"
    echo "/data/uploads permissions: $(ls -ld /data/uploads)"
    echo "/data/results permissions: $(ls -ld /data/results)"
else
    echo "ERROR: /data directory does not exist!"
    echo "Please ensure /data volume is mounted"
    exit 1
fi

# 详细的权限测试
echo "Directory setup completed successfully"
echo "Running detailed permission tests..."

# 检查文件系统类型
echo "Filesystem info for /data:"
df -T /data | tail -1
echo "Mount options:"
mount | grep /data

# 检查ACL
echo "ACL information:"
getfacl /data 2>/dev/null || echo "No ACL support or getfacl not available"

# 测试nextjs用户的实际权限
echo "Testing nextjs user capabilities:"
su-exec nextjs:nodejs ls -la /data/
su-exec nextjs:nodejs touch /data/uploads/test_file_$$
if [ $? -eq 0 ]; then
    echo "SUCCESS: nextjs can write to /data/uploads"
    rm -f /data/uploads/test_file_$$
else
    echo "FAILURE: nextjs cannot write to /data/uploads"
    echo "This is a critical error - the application will not work properly"
    echo "Please check the storage system configuration"
    exit 1
fi

echo "All permission tests passed"

# 切换到nextjs用户启动应用
echo "Starting Next.js application as nextjs user..."

# 数据库初始化（按需）
if [ -n "$DATABASE_URL" ]; then
  if [ "${DB_BOOTSTRAP:-1}" = "1" ]; then
    echo "[ENTRYPOINT] DB_BOOTSTRAP=1 → syncing schema & bootstrap"
    su-exec nextjs:nodejs npx prisma db push --schema=/app/prisma/schema.prisma || echo "[ENTRYPOINT] prisma db push failed"
    su-exec nextjs:nodejs node /app/scripts/bootstrap.js || echo "[ENTRYPOINT] bootstrap script failed"
  else
    echo "[ENTRYPOINT] DB_BOOTSTRAP=0 → skip prisma db push & bootstrap"
  fi
else
  echo "[ENTRYPOINT] Skip DB steps (no DATABASE_URL)"
fi

exec su-exec nextjs:nodejs npm run start:prod
