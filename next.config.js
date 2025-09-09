/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['moretop10.com'],
  },
  output: 'standalone',
  // 增加API路由的超时时间
  experimental: {
    serverComponentsExternalPackages: []
  },
  // 配置body大小限制和超时
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ]
  },
}

module.exports = nextConfig