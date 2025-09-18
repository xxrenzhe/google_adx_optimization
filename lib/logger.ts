export function logInfo(tag: string, message: string, meta?: Record<string, any>) {
  try {
    const ts = new Date().toISOString()
    if (meta) console.log(`[${ts}] [INFO] [${tag}] ${message}`, safeMeta(meta))
    else console.log(`[${ts}] [INFO] [${tag}] ${message}`)
  } catch { /* noop */ }
}

export function logWarn(tag: string, message: string, meta?: Record<string, any>) {
  try {
    const ts = new Date().toISOString()
    if (meta) console.warn(`[${ts}] [WARN] [${tag}] ${message}`, safeMeta(meta))
    else console.warn(`[${ts}] [WARN] [${tag}] ${message}`)
  } catch { /* noop */ }
}

export function logError(tag: string, message: string, error?: unknown, meta?: Record<string, any>) {
  try {
    const ts = new Date().toISOString()
    const parts = [`[${ts}] [ERROR] [${tag}] ${message}`]
    if (error) parts.push(errToString(error))
    if (meta) parts.push(JSON.stringify(safeMeta(meta)))
    console.error(parts.join(' '))
  } catch { /* noop */ }
}

export function timeStart(tag: string, op: string, meta?: Record<string, any>) {
  const start = Date.now()
  logInfo(tag, `${op} start`, { ...(meta||{}), t0: start })
  return () => {
    const ms = Date.now() - start
    logInfo(tag, `${op} done`, { ...(meta||{}), duration_ms: ms })
    return ms
  }
}

function errToString(e: unknown) {
  if (!e) return ''
  if (e instanceof Error) return e.stack || e.message
  try { return JSON.stringify(e) } catch { return String(e) }
}

function safeMeta(meta: Record<string, any>) {
  const m: Record<string, any> = {}
  for (const k of Object.keys(meta)) {
    const v = (meta as any)[k]
    if (typeof v === 'string' && v.length > 500) m[k] = v.slice(0, 500) + '...'
    else m[k] = v
  }
  return m
}

