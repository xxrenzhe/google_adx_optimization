#!/bin/bash

# 测试脚本：验证50万行数据处理能力

echo "🚀 开始测试50万行数据处理能力..."

# 1. 检查内存限制
echo "📊 检查系统内存..."
free -h

# 2. 生成测试文件（如果不存在）
if [ ! -f "test-data-500k.csv" ]; then
    echo "📝 生成50万行测试数据..."
    python3 generate-test-data.py
fi

# 3. 检查文件大小
echo "📏 检查测试文件..."
ls -lh test-data-500k.csv

# 4. 启动开发服务器
echo "🚀 启动开发服务器..."
npm run dev &
SERVER_PID=$!

# 等待服务器启动
sleep 10

# 5. 测试文件上传
echo "📤 测试文件上传..."
curl -X POST http://localhost:3000/api/upload-optimized \
  -F "file=@test-data-500k.csv" \
  -H "Accept: application/json" \
  -o upload-response.json

# 6. 检查上传响应
echo "✅ 检查上传响应..."
cat upload-response.json

# 提取fileId
FILE_ID=$(jq -r '.fileId' upload-response.json)
echo "📄 文件ID: $FILE_ID"

# 7. 轮询处理状态
echo "⏳ 轮询处理状态..."
for i in {1..60}; do
    curl -s http://localhost:3000/api/result/$FILE_ID > status.json
    STATUS=$(jq -r '.status' status.json)
    PROGRESS=$(jq -r '.progress' status.json)
    
    echo "状态: $STATUS, 进度: $PROGRESS%"
    
    if [ "$STATUS" = "completed" ]; then
        echo "✅ 处理完成！"
        break
    elif [ "$STATUS" = "failed" ]; then
        echo "❌ 处理失败！"
        cat status.json
        break
    fi
    
    sleep 5
done

# 8. 检查内存使用
echo "📊 检查Node.js进程内存..."
ps aux | grep node | grep -v grep

# 9. 清理
echo "🧹 清理..."
kill $SERVER_PID
rm -f upload-response.json status.json

echo "✅ 测试完成！"