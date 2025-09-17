import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { prisma } from './prisma-extended'
import { parseCSVLine, createColumnMap } from './file-processing'

// Optional COPY import
let pg: any, copyFrom: any
try {
  pg = require('pg')
  copyFrom = require('pg-copy-streams').from
} catch {}

type QueueItem = {
  sessionId: string
  filePath: string
  fileName: string
  fileSize: number
}

// PostgreSQL 批量落库导入器（简化版）：按行解析 -> 批量 createMany(skipDuplicates)
export class DBIngestionController {
  private static instance: DBIngestionController
  private queue: QueueItem[] = []
  private running = false

  static getInstance() {
    if (!DBIngestionController.instance) {
      DBIngestionController.instance = new DBIngestionController()
    }
    return DBIngestionController.instance
  }

  async add(sessionId: string, filePath: string, fileName: string, fileSize: number) {
    this.queue.push({ sessionId, filePath, fileName, fileSize })
    if (!this.running) this.process()
  }

  private async process() {
    if (this.running) return
    this.running = true

    while (this.queue.length > 0) {
      const item = this.queue.shift()!
      try {
        await this.importFile(item)
      } catch (e) {
        console.error('[DB-IMPORT] import failed:', e)
        await prisma.uploadSession.update({
          where: { id: item.sessionId },
          data: { status: 'failed', errorMessage: (e as Error).message }
        })
      }
    }

    this.running = false
  }

  private async importFile({ sessionId, filePath }: QueueItem) {
    // 尝试使用 COPY 导入（可通过环境变量控制）
    if (process.env.USE_PG_COPY === '1' && pg && copyFrom) {
      try {
        await this.copyImport(sessionId, filePath)
        return
      } catch (e) {
        console.warn('[DB-IMPORT] COPY import failed, fallback to batch inserts:', (e as Error).message)
      }
    }

    const stream = createReadStream(filePath, { highWaterMark: 64 * 1024 })
    const rl = createInterface({ input: stream, crlfDelay: Infinity, terminal: false })

    let lineCount = 0
    let headers: string[] = []
    let columnMap: Record<string, number> = {}

    const batchSize = 1000
    let batch: any[] = []
    let inserted = 0

    for await (const line of rl) {
      if (lineCount === 0) {
        headers = parseCSVLine(line)
        columnMap = createColumnMap(headers)
        if (columnMap.date === undefined || columnMap.website === undefined) {
          throw new Error('CSV文件必须包含日期和网站列')
        }
        lineCount++
        continue
      }

      const cols = parseCSVLine(line)
      const get = (k: string, def: string = 'Unknown') => {
        const idx = columnMap[k]
        return idx === undefined ? def : (cols[idx] || def)
      }
      const getNum = (k: string, def = 0) => {
        const idx = columnMap[k]
        if (idx === undefined) return def
        const v = parseFloat(cols[idx])
        return isNaN(v) ? def : v
      }
      const getBig = (k: string) => {
        const idx = columnMap[k]
        if (idx === undefined) return null
        const v = cols[idx] && cols[idx].trim() !== '' ? BigInt(parseInt(cols[idx])) : null
        return v
      }

      const dataDate = new Date(get('date', ''))
      const website = get('website')
      const country = get('country')
      const adFormat = get('adFormat')
      const adUnit = get('adUnit')
      const advertiser = get('advertiser')
      const domain = get('domain', website)
      const device = get('device')
      const browser = get('browser')

      const impressions = getBig('impressions')
      const clicks = getBig('clicks')
      const requests = getBig('requests')
      const revenue = getNum('revenue', 0)
      const ctr = impressions && impressions > 0n && clicks !== null ? Number(clicks) / Number(impressions) * 100 : getNum('ctr', 0)
      const ecpm = impressions && impressions > 0n ? (revenue / Number(impressions)) * 1000 : getNum('ecpm', 0)
      const viewableImpressions = getBig('viewableImpressions')
      const viewabilityRate = getNum('viewabilityRate', 0)
      const measurableImpressions = getBig('measurableImpressions')
      const fillRate = requests && requests > 0n && impressions ? Number(impressions) / Number(requests) * 100 : null

      batch.push({
        sessionId,
        uploadDate: new Date(),
        dataDate,
        website,
        country,
        adFormat,
        adUnit,
        advertiser,
        domain,
        device,
        browser,
        requests,
        impressions,
        clicks,
        ctr,
        ecpm,
        revenue,
        viewableImpressions,
        viewabilityRate,
        measurableImpressions,
        fillRate
      })

      if (batch.length >= batchSize) {
        await prisma.adReport.createMany({ data: batch as any[], skipDuplicates: true })
        inserted += batch.length
        batch = []
      }
      lineCount++
    }

    if (batch.length > 0) {
      await prisma.adReport.createMany({ data: batch as any[], skipDuplicates: true })
      inserted += batch.length
      batch = []
    }

    // 维护 Sites 表
    const sites = await prisma.adReport.findMany({
      where: { sessionId },
      select: { website: true },
      distinct: ['website']
    })
    for (const s of sites) {
      const domain = s.website || 'Unknown'
      await (prisma as any).site.upsert({
        where: { domain },
        update: { lastSeen: new Date() },
        create: { domain, firstSeen: new Date(), lastSeen: new Date() }
      })
    }

    await prisma.uploadSession.update({
      where: { id: sessionId },
      data: { status: 'completed', recordCount: inserted, processedAt: new Date() }
    })
  }

  private async copyImport(sessionId: string, filePath: string) {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    const client = await pool.connect()
    try {
      await prisma.uploadSession.update({ where: { id: sessionId }, data: { status: 'processing', errorMessage: null } })

      // 解析表头，构建列映射
      const rlHead = createInterface({ input: createReadStream(filePath, { start: 0, highWaterMark: 256 * 1024 }), crlfDelay: Infinity })
      let headerLine = ''
      for await (const line of rlHead) { headerLine = line; break }
      const headers = parseCSVLine(headerLine)
      const columnMap = createColumnMap(headers)
      if (columnMap.date === undefined || columnMap.website === undefined) {
        throw new Error('CSV文件必须包含日期和网站列')
      }

      // 使用会话级临时表，结构同 AdReport（仅默认值）
      await client.query('BEGIN')
      await client.query('CREATE TEMP TABLE IF NOT EXISTS staging_adreport (LIKE "AdReport" INCLUDING DEFAULTS);')

      // COPY 到临时表（指定列）
      const cols = [
        'sessionId','uploadDate','dataDate','website','country','adFormat','adUnit','advertiser','domain','device','browser',
        'requests','impressions','clicks','ctr','ecpm','revenue','viewableImpressions','viewabilityRate','measurableImpressions','fillRate','arpu'
      ]
      const colsQuoted = cols.map(c => '"' + c + '"')
      const copySql = `COPY staging_adreport(${colsQuoted.join(',')}) FROM STDIN WITH (FORMAT csv)`
      const dbStream = client.query(copyFrom(copySql))

      const readStream = createReadStream(filePath, { highWaterMark: 256 * 1024 })
      const rl = createInterface({ input: readStream, crlfDelay: Infinity })
      let lineCount = 0
      let processed = 0
      let skippedHeader = false

      const write = (line: string) => new Promise<void>((resolve, reject) => {
        if (!dbStream.write(line)) dbStream.once('drain', () => resolve())
        else resolve()
      })

      for await (const line of rl) {
        if (!skippedHeader) { skippedHeader = true; continue }
        lineCount++
        const colsParsed = parseCSVLine(line)
        // 提取与转换
        const get = (k: string, def: string = 'Unknown') => {
          const idx = columnMap[k]
          return idx === undefined ? def : (colsParsed[idx] || def)
        }
        const getNum = (k: string, def = 0) => {
          const idx = columnMap[k]
          if (idx === undefined) return def
          const v = parseFloat(colsParsed[idx])
          return isNaN(v) ? def : v
        }
        const getBigStr = (k: string) => {
          const idx = columnMap[k]
          if (idx === undefined) return ''
          const raw = colsParsed[idx]
          const v = raw && raw.trim() !== '' ? String(parseInt(raw)) : ''
          return v
        }

        const dataDate = get('date','')
        const website = get('website')
        const country = get('country','')
        const adFormat = get('adFormat','')
        const adUnit = get('adUnit','')
        const advertiser = get('advertiser','')
        const domain = get('domain', website)
        const device = get('device','')
        const browser = get('browser','')

        const impressions = getNum('impressions', 0)
        const clicks = getNum('clicks', 0)
        const requests = getNum('requests', 0)
        const revenue = getNum('revenue', 0)
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : getNum('ctr', 0)
        const ecpm = impressions > 0 ? (revenue / impressions) * 1000 : getNum('ecpm', 0)
        const viewableImpressions = getNum('viewableImpressions', 0)
        const viewabilityRate = getNum('viewabilityRate', 0)
        const measurableImpressions = getNum('measurableImpressions', 0)
        const fillRate = requests > 0 ? (impressions / requests) * 100 : 0
        const arpu = getNum('arpu', 0)

        // 组装 CSV 行（与 columns 顺序一致）
        const row = [
          q(sessionId), q(new Date().toISOString()), q(dataDate), q(website), qOrEmpty(country), qOrEmpty(adFormat), qOrEmpty(adUnit), qOrEmpty(advertiser), q(domain), qOrEmpty(device), qOrEmpty(browser),
          nOrEmpty(requests), nOrEmpty(impressions), nOrEmpty(clicks), nOrEmpty(ctr), nOrEmpty(ecpm), nOrEmpty(revenue), nOrEmpty(viewableImpressions), nOrEmpty(viewabilityRate), nOrEmpty(measurableImpressions), nOrEmpty(fillRate), nOrEmpty(arpu)
        ].join(',') + '\n'

        await write(row)
        processed++
        if (processed % 5000 === 0) {
          await prisma.uploadSession.update({ where: { id: sessionId }, data: { recordCount: processed, status: 'processing' } })
        }
      }

      await new Promise<void>((resolve, reject) => {
        dbStream.on('finish', () => resolve())
        dbStream.on('error', (e: any) => reject(e))
        dbStream.end()
      })

      // 合并到正式表（去重/覆盖）
      const conflictCols = '"dataDate","website","country","device","browser","adFormat","adUnit","advertiser","domain"'
      const insertCols = colsQuoted.join(',')
      const upsertSql = `
        INSERT INTO "AdReport" (${insertCols})
        SELECT ${insertCols} FROM staging_adreport
        ON CONFLICT (${conflictCols}) DO UPDATE SET
          "sessionId"=EXCLUDED."sessionId",
          "uploadDate"=EXCLUDED."uploadDate",
          "requests"=EXCLUDED."requests",
          "impressions"=EXCLUDED."impressions",
          "clicks"=EXCLUDED."clicks",
          "ctr"=EXCLUDED."ctr",
          "ecpm"=EXCLUDED."ecpm",
          "revenue"=EXCLUDED."revenue",
          "viewableImpressions"=EXCLUDED."viewableImpressions",
          "viewabilityRate"=EXCLUDED."viewabilityRate",
          "measurableImpressions"=EXCLUDED."measurableImpressions",
          "fillRate"=EXCLUDED."fillRate",
          "arpu"=EXCLUDED."arpu";
      `
      await client.query(upsertSql)
      await client.query('COMMIT')

      // 更新站点表
      const sites = await prisma.adReport.findMany({ where: { sessionId }, select: { website: true }, distinct: ['website'] })
      for (const s of sites) {
        const domain = s.website || 'Unknown'
        await (prisma as any).site.upsert({ where: { domain }, update: { lastSeen: new Date() }, create: { domain, firstSeen: new Date(), lastSeen: new Date() } })
      }

      await prisma.uploadSession.update({ where: { id: sessionId }, data: { status: 'completed', recordCount: processed, processedAt: new Date() } })
    } catch (e) {
      await client.query('ROLLBACK').catch(()=>{})
      await prisma.uploadSession.update({ where: { id: sessionId }, data: { status: 'failed', errorMessage: (e as Error).message } })
      throw e
    } finally {
      client.release()
      await pool.end()
    }
  }
}

function q(v: string) { return '"' + String(v).replace(/"/g,'""') + '"' }
function qOrEmpty(v: string) { return v ? q(v) : '' }
function nOrEmpty(v: number) { return isFinite(v) && v !== null ? String(v) : '' }
