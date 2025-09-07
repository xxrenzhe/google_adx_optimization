#!/bin/bash

# 创建必要的目录
mkdir -p uploads
mkdir -p results

# 设置权限
chmod 755 uploads
chmod 755 results

echo "Created uploads and results directories"

# 启动应用
exec npm start