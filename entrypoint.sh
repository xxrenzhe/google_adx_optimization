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

# 简化的权限测试 - 只要目录存在且有正确的所有者就继续
echo "Directory setup completed successfully"
echo "Application will run with nextjs user privileges"

# 切换到nextjs用户启动应用
echo "Starting Next.js application as nextjs user..."
exec su-exec nextjs:nodejs npm run start:prod