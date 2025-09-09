#!/bin/sh
# 启动脚本 - 确保/data目录有正确权限

echo "Starting Google ADX Optimization..."
echo "Current user: $(whoami)"
echo "Current UID: $(id -u)"
echo "Current GID: $(id -g)"

# 检查/data目录
if [ -d "/data" ]; then
    echo "/data directory exists"
    echo "/data permissions: $(ls -ld /data)"
    
    # 确保有权限访问
    if [ ! -w "/data" ]; then
        echo "Fixing /data permissions..."
        # 尝试修复权限
        sudo chmod 755 /data 2>/dev/null || chmod 755 /data
        sudo chown -R nextjs:nodejs /data 2>/dev/null || chown -R $(id -u):$(id -g) /data
        echo "Fixed /data permissions: $(ls -ld /data)"
    fi
    
    # 创建子目录
    echo "Creating subdirectories..."
    mkdir -p /data/uploads /data/results
    chmod 755 /data/uploads /data/results
    
    # 如果是root用户，更改owner
    if [ "$(id -u)" = "0" ]; then
        chown -R nextjs:nodejs /data
        echo "Set /data ownership to nextjs:nodejs"
    fi
    
    echo "Final /data permissions: $(ls -ld /data)"
    echo "/data/uploads permissions: $(ls -ld /data/uploads)"
    echo "/data/results permissions: $(ls -ld /data/results)"
else
    echo "ERROR: /data directory does not exist!"
    echo "Please ensure /data volume is mounted"
    exit 1
fi

# 测试写入权限
echo "Testing write permissions..."
touch /data/uploads/.test 2>/dev/null
if [ $? -eq 0 ]; then
    echo "Write test successful"
    rm -f /data/uploads/.test
else
    echo "ERROR: Cannot write to /data/uploads"
    exit 1
fi

# 启动应用
echo "Starting Next.js application..."
exec npm run start:prod