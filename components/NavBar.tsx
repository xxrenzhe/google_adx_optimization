"use client"

import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/', label: 'Home' },
  { href: '/report', label: 'Report' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/analytics-enhanced', label: 'Enhanced' },
  { href: '/alerts', label: 'Alerts' },
  { href: '/predictive', label: 'Predictive' },
  { href: '/automation', label: 'Automation' },
  { href: '/upload', label: 'Upload' },
  { href: '/charts/edit', label: 'Edit Queries' },
]

export default function NavBar() {
  const pathname = usePathname() || '/'
  return (
    <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between">
      <div className="flex items-center gap-6">
        {tabs.map(t => {
          const active = pathname === t.href || (t.href !== '/' && pathname.startsWith(t.href))
          return (
            <a
              key={t.href}
              className={(active
                ? 'text-white'
                : 'text-white/85 hover:text-white') + ' font-semibold text-[15px] md:text-[16px]'}
              href={t.href}
            >{t.label}</a>
          )
        })}
      </div>
    </div>
  )
}
