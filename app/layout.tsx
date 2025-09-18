import './globals.css'
import 'flatpickr/dist/themes/airbnb.css'
import type { Metadata } from 'next'
import { Poppins, Rubik } from 'next/font/google'
import { FileSessionProvider } from '@/contexts/file-session'
import '@/lib/init' // 初始化资源监控
import NavBar from '@/components/NavBar'
import QueryNormalizer from '@/components/QueryNormalizer'

const poppins = Poppins({ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--font-poppins', display: 'swap' })
const rubik = Rubik({ subsets: ['latin'], weight: ['400','500','700'], variable: '--font-rubik', display: 'swap' })

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
      <body className={`${poppins.variable} ${rubik.variable} font-sans`}>
        <FileSessionProvider>
          <div id="global-navbar" className="bg-[#292466] text-white border-b sticky top-0 z-10">
            {/* 客户端高亮当前路由 */}
            {/* @ts-expect-error Server Component import Client Component */}
            <NavBar />
          </div>
          {/* @ts-expect-error Server Component import Client Component */}
          <QueryNormalizer />
          {children}
        </FileSessionProvider>
      </body>
    </html>
  )
}
