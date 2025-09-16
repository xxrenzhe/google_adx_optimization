import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma-extended'
import { parseCSVLine, createColumnMap } from '@/lib/file-processing'

let pg: any, copyFrom: any
try { pg = require('pg'); copyFrom = require('pg-copy-streams').from } catch {}

function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(Boolean)
  const rows: string[][] = []
  let inQuotes = false
  let cur = ''
  let row: string[] = []
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuotes = !inQuotes; continue }
      if (ch === ',' && !inQuotes) { row.push(cur); cur = '' } else { cur += ch }
    }
    if (!inQuotes) { row.push(cur); rows.push(row.map(s=>s.trim())); row=[]; cur='' } else { cur+='\n' }
  }
  if (row.length || cur) { row.push(cur); rows.push(row) }
  return rows
}

function mapHeaders(headers: string[]) {
  const n = (s:string)=>s.trim().toLowerCase()
  const map: Record<string, number> = {}
  headers.forEach((h, idx) => {
    const s = n(h)
    if ([ 'date','日期' ].includes(s)) map['date']=idx
    else if ([ 'website','domain','站点','网站','域名' ].includes(s)) map['website']=idx
    else if ([ 'revenue','收入' ].includes(s)) map['revenue']=idx
    else if ([ 'impressions','展示','展示数' ].includes(s)) map['impressions']=idx
    else if ([ 'pageviews','pv','页面浏览量' ].includes(s)) map['pageviews']=idx
    else if ([ 'paid_clicks','paidclicks','付费点击' ].includes(s)) map['paidClicks']=idx
  })
  return map
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: '未找到文件' }, { status: 400 })

    const session = await (prisma as any).uploadSession.create({
      data: { filename: file.name, status: 'uploading', tempTableName: `staging_yahoo_${crypto.randomUUID().replace(/-/g,'')}`, fileSize: file.size, dataType: 'yahoo' }
    })

    if (process.env.USE_PG_COPY === '1' && pg && copyFrom) {
      try {
        const inserted = await copyImportYahoo(session.id, file)
        return NextResponse.json({ ok: true, inserted, fileName: file.name })
      } catch (e) {
        console.warn('[upload-yahoo] COPY failed, fallback to batch:', (e as Error).message)
      }
    }

    const text = await file.text()
    const rows = parseCSV(text)
    if (rows.length < 2) return NextResponse.json({ error: '空文件' }, { status: 400 })
    const headers = rows[0]
    const map = mapHeaders(headers)
    if (map.date === undefined || map.website === undefined || map.revenue === undefined) return NextResponse.json({ error: '缺少必要列（日期/网站/收入）' }, { status: 400 })

    const batch: any[] = []
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      const dateStr = r[map.date]
      if (!dateStr) continue
      const website = r[map.website] || 'Unknown'
      const revenue = parseFloat(r[map.revenue] || '0')
      const impressions = map.impressions !== undefined ? BigInt(parseInt(r[map.impressions] || '0')) : null
      const pageviews = map.pageviews !== undefined ? BigInt(parseInt(r[map.pageviews] || '0')) : null
      const paidClicks = map.paidClicks !== undefined ? BigInt(parseInt(r[map.paidClicks] || '0')) : null
      batch.push({ dataDate: new Date(dateStr), website, revenue, impressions, pageviews, paidClicks })
    }
    const size = 1000
    const db = prisma as any
    for (let i = 0; i < batch.length; i += size) {
      await db.yahooRevenue.createMany({ data: batch.slice(i, i+size), skipDuplicates: true })
    }
    await db.uploadSession.update({ where: { id: session.id }, data: { status: 'completed', recordCount: batch.length, processedAt: new Date() } })
    return NextResponse.json({ ok: true, inserted: batch.length, fileName: file.name })
  } catch (e) {
    console.error('upload-yahoo error:', e)
    return NextResponse.json({ error: '导入失败' }, { status: 500 })
  }
}

async function copyImportYahoo(sessionId: string, file: File): Promise<number> {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()
  try {
    await prisma.uploadSession.update({ where: { id: sessionId }, data: { status: 'processing', errorMessage: null } })
    const fullText = await file.text()
    const lines = fullText.split(/\r?\n/)
    const headers = parseCSVLine(lines.shift() || '')
    const map = createColumnMap(headers)
    if (map.date === undefined || map.website === undefined || map.revenue === undefined) throw new Error('缺少必要列（日期/网站/收入）')

    await client.query('BEGIN')
    await client.query('CREATE TEMP TABLE IF NOT EXISTS staging_yahoo (LIKE public.yahoo_revenue INCLUDING DEFAULTS);')
    const cols = ['dataDate','website','revenue','impressions','pageviews','paidClicks']
    const copySql = `COPY staging_yahoo(${cols.join(',')}) FROM STDIN WITH (FORMAT csv)`
    const dbStream = client.query(copyFrom(copySql))

    let processed = 0
    const write = (line: string) => new Promise<void>((resolve) => { if (!dbStream.write(line)) dbStream.once('drain', () => resolve()); else resolve() })
    for (const line of lines) {
      if (!line) continue
      const colsParsed = parseCSVLine(line)
      const get = (k: string, def: string = '') => { const idx = (map as any)[k]; return idx === undefined ? def : (colsParsed[idx] || def) }
      const getNum = (k: string, def = 0) => { const idx = (map as any)[k]; if (idx === undefined) return def; const v = parseFloat(colsParsed[idx]); return isNaN(v) ? def : v }
      const getBigStr = (k: string) => { const idx = (map as any)[k]; if (idx === undefined) return ''; const raw = colsParsed[idx]; const v = raw && raw.trim() !== '' ? String(parseInt(raw)) : ''; return v }
      const row = [ q(get('date','')), q(get('website','Unknown')), nOrEmpty(getNum('revenue',0)), nOrEmpty(parseInt(getBigStr('impressions')||'0')), nOrEmpty(parseInt(getBigStr('pageviews')||'0')), nOrEmpty(parseInt(getBigStr('paidClicks')||'0')) ].join(',') + '\n'
      await write(row)
      processed++
      if (processed % 5000 === 0) await prisma.uploadSession.update({ where: { id: sessionId }, data: { status: 'processing', recordCount: processed } })
    }
    await new Promise<void>((resolve, reject) => { dbStream.on('finish', () => resolve()); dbStream.on('error', (e: any) => reject(e)); dbStream.end() })
    const upsertSql = `
      INSERT INTO public.yahoo_revenue (${cols.join(',')})
      SELECT ${cols.join(',')} FROM staging_yahoo
      ON CONFLICT ("dataDate","website") DO UPDATE SET
        "revenue"=EXCLUDED."revenue",
        "impressions"=EXCLUDED."impressions",
        "pageviews"=EXCLUDED."pageviews",
        "paidClicks"=EXCLUDED."paidClicks";
    `
    await client.query(upsertSql)
    await client.query('COMMIT')
    await prisma.uploadSession.update({ where: { id: sessionId }, data: { status: 'completed', recordCount: processed, processedAt: new Date() } })
    return processed
  } catch (e) {
    await client.query('ROLLBACK').catch(()=>{})
    await prisma.uploadSession.update({ where: { id: sessionId }, data: { status: 'failed', errorMessage: (e as Error).message } })
    throw e
  } finally {
    client.release()
    await pool.end()
  }
}

function q(v: string) { return '"' + String(v).replace(/"/g,'""') + '"' }
function nOrEmpty(v: any) { const n = Number(v); return isFinite(n) ? String(n) : '' }
