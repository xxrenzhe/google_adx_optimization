'use client'

import { useEffect, useState } from 'react'

interface Props {
  open: boolean
  chartKey: string | null
  onClose: () => void
}

export default function ChartQueryEditorModal({ open, chartKey, onClose }: Props) {
  const [sqlText, setSqlText] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !chartKey) return
    setLoading(true)
    setMsg('')
    fetch(`/api/chart-queries?key=${encodeURIComponent(chartKey)}`)
      .then(r => r.json())
      .then(d => {
        setSqlText(d.item?.sqlText || '')
        setEnabled(d.item?.enabled ?? true)
      })
      .catch(e => setMsg('加载失败'))
      .finally(() => setLoading(false))
  }, [open, chartKey])

  const save = async () => {
    if (!chartKey) return
    setMsg('')
    setLoading(true)
    const res = await fetch(`/api/chart-queries/${encodeURIComponent(chartKey)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sqlText, enabled })
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setMsg(data.error || '保存失败')
    } else {
      setMsg('已保存')
      setTimeout(onClose, 600)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-3xl">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold">编辑查询：{chartKey}</div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800">✕</button>
          </div>
          <div className="p-4 space-y-3">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" className="accent-blue-600" checked={enabled} onChange={e=>setEnabled(e.target.checked)} /> 启用
            </label>
            <textarea
              className="w-full h-80 border rounded p-3 font-mono text-sm"
              value={sqlText}
              onChange={e=>setSqlText(e.target.value)}
              placeholder="仅允许单条 SELECT；支持 :from, :to, :site 命名参数"
            />
            <div className="text-xs text-gray-500">仅允许单条 SELECT；禁止分号与 DDL/DML/DCL；参数白名单：:from、:to、:site。</div>
            {msg && <div className="text-sm text-gray-700">{msg}</div>}
          </div>
          <div className="px-4 py-3 border-t flex items-center justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 border rounded">取消</button>
            <button onClick={save} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">{loading? '保存中…' : '保存'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

