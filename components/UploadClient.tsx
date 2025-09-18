"use client"

import { useEffect, useState } from 'react'

export type UploadHistoryItem = {
  id: string
  filename: string
  fileSize: number | null
  status: string
  recordCount: number | null
  uploadedAt: string
  processedAt: string | null
  dataType?: string | null
  source?: string | null
  errorMessage?: string | null
}

export default function UploadClient({ initialHistory = [] as UploadHistoryItem[] }: { initialHistory?: UploadHistoryItem[] }) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [history, setHistory] = useState<UploadHistoryItem[]>(initialHistory)
  const [activeType, setActiveType] = useState<'adx'|'offer'|'yahoo'|'cost'>('adx')
  const [costSource, setCostSource] = useState<string>('google')

  const tryFetchJSON = async (url: string) => {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
    const ct = res.headers.get('content-type') || ''
    if (res.ok && ct.includes('application/json')) return await res.json()
    throw new Error(`${res.status} ${res.statusText}`)
  }

  const loadHistory = async () => {
    try {
      let data: any | null = null
      try { data = await tryFetchJSON('/api/uploads/history?limit=10') } catch {}
      if (!data) { try { data = await tryFetchJSON('/api/uploads?limit=10') } catch {} }
      if (data && data.ok) setHistory(data.items)
    } catch (e) {
      // 静默
      console.warn('加载上传历史失败', e)
    }
  }

  useEffect(() => { loadHistory().catch(()=>{}) }, [])

  const parseResponse = async (res: Response) => {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return await res.json()
    const text = await res.text(); throw new Error(`${res.status} ${res.statusText}: ${text.slice(0,200)}`)
  }

  const onUpload = async () => {
    if (!file) return
    setUploading(true)
    setMessage('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      let url = '/api/upload-db'
      if (activeType === 'offer') url = '/api/upload-offer'
      else if (activeType === 'yahoo') url = '/api/upload-yahoo'
      else if (activeType === 'cost') { url = '/api/upload-costs'; fd.append('source', costSource) }
      const res = await fetch(url, { method: 'POST', body: fd })
      const data = await parseResponse(res)
      if (!res.ok) throw new Error(data.error || '上传失败')
      setMessage(`上传成功：${data.fileName || file.name}`)
      setFile(null)
      loadHistory().catch(()=>{})
    } catch (e: any) {
      setMessage(`错误：${e.message}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-2 md:pt-3 px-4 md:px-5 pb-4 md:pb-5">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-4">上传 CSV（写入数据库）</h1>
          <p className="text-sm text-gray-600 mb-4">仅支持 CSV；导入后数据落库（幂等去重），仅文件保留30天。</p>
          <div className="flex items-center gap-3 mb-4">
            <label className={`px-3 py-1 rounded cursor-pointer border ${activeType==='adx'?'bg-blue-600 text-white border-blue-600':'border-gray-300'}`}>
              <input type="radio" name="dtype" className="hidden" checked={activeType==='adx'} onChange={()=>setActiveType('adx')} />ADX（Google ADX 报表）
            </label>
            <label className={`px-3 py-1 rounded cursor-pointer border ${activeType==='offer'?'bg-blue-600 text-white border-blue-600':'border-gray-300'}`}>
              <input type="radio" name="dtype" className="hidden" checked={activeType==='offer'} onChange={()=>setActiveType('offer')} />Offer 收入
            </label>
            <label className={`px-3 py-1 rounded cursor-pointer border ${activeType==='yahoo'?'bg-blue-600 text-white border-blue-600':'border-gray-300'}`}>
              <input type="radio" name="dtype" className="hidden" checked={activeType==='yahoo'} onChange={()=>setActiveType('yahoo')} />Yahoo 收入
            </label>
            <label className={`px-3 py-1 rounded cursor-pointer border ${activeType==='cost'?'bg-blue-600 text-white border-blue-600':'border-gray-300'}`}>
              <input type="radio" name="dtype" className="hidden" checked={activeType==='cost'} onChange={()=>setActiveType('cost')} />广告成本
            </label>
            {activeType==='cost' && (
              <select className="ml-2 border rounded px-2 py-1" value={costSource} onChange={e=>setCostSource(e.target.value)}>
                <option value="google">google</option>
                <option value="bing">bing</option>
                <option value="other">other</option>
              </select>
            )}
          </div>
          <div className="flex items-center gap-4">
            <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <button onClick={onUpload} disabled={!file || uploading} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
              {uploading ? '上传中…' : '上传并导入'}
            </button>
          </div>
          {message && <p className="mt-3 text-sm text-gray-700">{message}</p>}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">最近 10 次上传</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-4">文件名</th>
                  <th className="py-2 pr-4">类型</th>
                  <th className="py-2 pr-4">来源</th>
                  <th className="py-2 pr-4">大小</th>
                  <th className="py-2 pr-4">状态</th>
                  <th className="py-2 pr-4">记录数</th>
                  <th className="py-2 pr-4">上传时间</th>
                  <th className="py-2 pr-4">完成时间</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td className="py-2 pr-4 text-gray-500" colSpan={8}>暂无历史记录</td></tr>
                ) : history.map((h) => (
                  <tr key={h.id} className="border-t">
                    <td className="py-2 pr-4">{h.filename}</td>
                    <td className="py-2 pr-4">{h.dataType || 'adx'}</td>
                    <td className="py-2 pr-4">{h.source || '-'}</td>
                    <td className="py-2 pr-4">{h.fileSize ? `${(h.fileSize/1024/1024).toFixed(2)} MB` : '-'}</td>
                    <td className="py-2 pr-4">{h.status}</td>
                    <td className="py-2 pr-4">{h.recordCount ?? '-'}</td>
                    <td className="py-2 pr-4">{new Date(h.uploadedAt).toLocaleString('zh-CN')}</td>
                    <td className="py-2 pr-4">{h.processedAt ? new Date(h.processedAt).toLocaleString('zh-CN') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

