/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['moretop10.com'],
  },
  output: 'standalone',
}

module.exports = nextConfig