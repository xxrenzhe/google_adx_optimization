import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { FileSessionProvider } from '@/contexts/file-session'
import '@/lib/init' // 初始化资源监控

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
})

export const metadata: Metadata = {
  title: 'Google ADX Optimization',
  description: 'Optimize your ad revenue with data-driven insights',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={`${inter.className} font-sans`}>
        <FileSessionProvider>
          {children}
        </FileSessionProvider>
      </body>
    </html>
  )
}