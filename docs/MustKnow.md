严格遵循如下约束条件：
1. 遵循简单实用的原则，不要过度设计
2. 如果可以用简单的代码实现，就不要用复杂的模式
3. 在满足业务需求的情况下，只实现核心功能，移除花哨但无用的功能
4. 保留 Clean Architecture 的核心思想，但需要简化实现
5. 合理拆分模块的功能和职责，避免单模块过大
6. 功能实现需要确保轻量高性能，能够支持多用户并发处理
7. 确保可维护性和可靠性
8. 借助Context7 MCP获取最新的技术文档，确保技术实现的准确性和稳定性
9. 若需要在数据库中创建新的库和表，则需要避免和数据库中已存在的其他项目数据冲突

背景知识，在设计时需要考虑，不要违反：
1）部署流程：代码部署发布分2步，第一步：利用Github action生成不同环境的docker镜像；第二步，手动在ClawCloud上配置镜像拉取并部署
- 代码推送带main分支，触发production环境docker镜像构建：标注 docker image tag 为 ghcr.io/xxrenzhe/google_adx_optimization:prod-latest
2）启动方式：使用标准的Next.js启动方式而不是自定义服务器
3）不同环境的域名
- 测试环境域名：localhost
- 生产环境域名：moretop10.com，容器内部域名是 adx-prod-xxx-xxx:3000
5）301强制跳转
- 生产环境，用户访问 https://moretop10.com 会301跳转到 https://www.moretop10.com
6）生产环境核心环境变量
- NODE_ENV=production
- NEXT_PUBLIC_DOMAIN=moretop10.com
- NEXT_PUBLIC_DEPLOYMENT_ENV=production
- DATABASE_URL="postgresql://postgres:w8mhnnqh@dbprovider.sg-members-1.clawcloudrun.com:32404/adx_optimization?directConnection=true"
- REDIS_URL="redis://default:9xdjb8nf@dbprovider.sg-members-1.clawcloudrun.com:32284"
7）预发/生产环境的容器配置：1C2G
