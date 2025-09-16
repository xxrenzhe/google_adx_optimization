#!/bin/bash

# Google ADX Optimization System - 快速部署脚本
# 使用方法: ./deploy.sh [dev|prod]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
ENV=${1:-prod}
PROJECT_NAME="google_adx_optimization"
REGISTRY="ghcr.io"
IMAGE_NAME="xxrenzhe/$PROJECT_NAME"

echo -e "${BLUE}🚀 Google ADX Optimization System - 快速部署脚本${NC}"
echo "============================================"
echo -e "环境: ${YELLOW}${ENV}${NC}"
echo ""

# 检查依赖
check_dependencies() {
    echo -e "${YELLOW}📋 检查依赖...${NC}"
    
    command -v git >/dev/null 2>&1 || { echo -e "${RED}❌ git 未安装${NC}" >&2; exit 1; }
    command -v docker >/dev/null 2>&1 || { echo -e "${RED}❌ docker 未安装${NC}" >&2; exit 1; }
    command -v psql >/dev/null 2>&1 || { echo -e "${YELLOW}⚠️  psql 未安装，数据库优化功能将不可用${NC}" >&2; }
    
    echo -e "${GREEN}✅ 依赖检查完成${NC}"
}

# 推送代码
push_code() {
    echo -e "${YELLOW}📤 推送代码到 GitHub...${NC}"
    
    # 检查是否有未提交的更改
    if [ -n "$(git status --porcelain)" ]; then
        echo -e "${YELLOW}发现未提交的更改，正在提交...${NC}"
        git add .
        git commit -m "Auto deploy: System optimization update $(date)"
    fi
    
    git push origin main
    echo -e "${GREEN}✅ 代码推送完成${NC}"
}

# 等待构建完成
wait_for_build() {
    echo -e "${YELLOW}🏗️  等待 GitHub Actions 构建完成...${NC}"
    
    # 获取最新commit SHA
    COMMIT_SHA=$(git rev-parse HEAD)
    
    echo "Commit SHA: $COMMIT_SHA"
    echo "请在 GitHub Actions 页面查看构建进度:"
    echo "https://github.com/xxrenzhe/google_adx_optimization/actions"
    
    # 简单等待（实际应该通过API检查）
    echo -e "${YELLOW}等待 2 分钟让构建完成...${NC}"
    sleep 120
    
    echo -e "${GREEN}✅ 构建应该已完成${NC}"
}

# 数据库优化
optimize_database() {
    echo -e "${YELLOW}🗄️  执行数据库优化...${NC}"
    
    if command -v psql >/dev/null 2>&1; then
        if [ -f "./deploy-db-optimization.sh" ]; then
            chmod +x ./deploy-db-optimization.sh
            ./deploy-db-optimization.sh
        else
            echo -e "${RED}❌ 数据库优化脚本不存在${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  跳过数据库优化（psql 未安装）${NC}"
    fi
}

# 生成部署命令
generate_deployment_commands() {
    echo ""
    echo -e "${BLUE}📋 下一步部署命令：${NC}"
    echo ""
    echo "1. 登录 ClawCloud 控制台"
    echo "2. 选择容器管理"
    echo "3. 创建新容器或更新现有容器"
    echo ""
    echo -e "${YELLOW}容器配置：${NC}"
    echo "----------------------------------------"
    echo "镜像: ${REGISTRY}/${IMAGE_NAME}:prod-latest"
    echo "端口: 3000:3000"
    echo "环境变量:"
    echo "  - NODE_ENV=production"
    echo "  - DATABASE_URL=postgresql://<user>:<pass>@<host>:<port>/<db>?schema=public"
    echo "  - REDIS_URL=redis://<user>:<pass>@<host>:<port>          # 可选"
    echo "  - DB_BOOTSTRAP=0                                        # 生产建议 0"
    echo "  - USE_PG_COPY=1                                         # 可选"
    echo ""
    echo "资源配置: 1C2G (推荐 2C4G)"
    echo "----------------------------------------"
    echo ""
}

# 显示验证步骤
show_verification_steps() {
    echo -e "${BLUE}✅ 部署验证清单：${NC}"
    echo ""
    echo "1. [ ] 容器成功启动"
    echo "2. [ ] 检查容器日志无错误"
    echo "3. [ ] 访问 https://www.moretop10.com"
    echo "4. [ ] 测试文件上传功能"
    echo "5. [ ] 验证数据分析结果"
    echo "6. [ ] 确认数据独立性"
    echo "7. [ ] 检查定时任务配置"
    echo ""
    echo -e "${YELLOW}💡 提示：${NC}"
    echo "- 使用浏览器开发者工具检查网络请求"
    echo "- 查看容器日志: docker logs <container_id>"
    echo "- 健康检查: curl https://www.moretop10.com/api/health"
    echo ""
}

# 主函数
main() {
    echo -e "${BLUE}开始部署流程...${NC}"
    echo ""
    
    check_dependencies
    push_code
    wait_for_build
    
    if [ "$ENV" = "prod" ]; then
        optimize_database
    fi
    
    generate_deployment_commands
    show_verification_steps
    
    echo -e "${GREEN}🎉 部署准备完成！${NC}"
    echo ""
    echo -e "${YELLOW}请按照上述步骤在 ClawCloud 上完成部署${NC}"
}

# 执行主函数
main "$@"
