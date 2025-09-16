import './globals.css'
import 'flatpickr/dist/themes/airbnb.css'
import type { Metadata } from 'next'
import { Poppins, Rubik } from 'next/font/google'
import { FileSessionProvider } from '@/contexts/file-session'
import '@/lib/init' // 初始化资源监控

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
          <div className="bg-white border-b sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <a className="font-bold" href="/">Dashboard</a>
                <a className="text-gray-600 hover:text-gray-900" href="/report">Report</a>
                <a className="text-gray-600 hover:text-gray-900" href="/analytics">Analytics</a>
                <a className="text-gray-600 hover:text-gray-900" href="/analytics-enhanced">Enhanced</a>
                <a className="text-gray-600 hover:text-gray-900" href="/alerts">Alerts</a>
                <a className="text-gray-600 hover:text-gray-900" href="/predictive">Predictive</a>
                <a className="text-gray-600 hover:text-gray-900" href="/automation">Automation</a>
                <a className="text-gray-600 hover:text-gray-900" href="/upload">Upload</a>
                <a className="text-gray-600 hover:text-gray-900" href="/charts/edit">Edit Queries</a>
              </div>
            </div>
          </div>
          {children}
        </FileSessionProvider>
      </body>
    </html>
  )
}
