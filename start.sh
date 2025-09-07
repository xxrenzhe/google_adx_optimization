#!/bin/bash

# 数据库初始化和启动脚本
# 这个脚本会在容器启动时自动运行

echo "🚀 Starting Google ADX Optimization System..."

# 确保我们在正确的目录
cd /app

# 等待数据库就绪
echo "⏳ Waiting for database to be ready..."
until npx prisma db execute --stdin --command="SELECT 1" > /dev/null 2>&1; do
    echo "Waiting for database connection..."
    sleep 2
done

echo "✅ Database is ready"

# 运行数据库初始化
echo "🗄️ Running database initialization..."
npx ts-node -r tsconfig-paths/register src/lib/db-init.ts

# 启动应用
echo "🎯 Starting Next.js application..."
exec npm start