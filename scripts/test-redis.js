#!/usr/bin/env node

/*
  Quick Redis connectivity tester

  Usage:
    node scripts/test-redis.js [--url=redis://user:pass@host:port] [--timeout=3000] [--insecure]

  Defaults:
    - --url     reads from process.env.REDIS_URL when not provided
    - --timeout connect timeout in ms (default 2000)
    - --insecure for self-signed TLS (only when using rediss://)

  What it does:
    1) Connects with the provided URL (with a connect timeout)
    2) Sends PING and measures latency
    3) Runs INFO and prints key server fields
    4) Performs a short SET/GET round trip
*/

const parseArgs = () => {
  const args = process.argv.slice(2)
  const out = { url: process.env.REDIS_URL || '', timeout: 2000, insecure: false }
  for (const a of args) {
    if (a.startsWith('--url=')) out.url = a.slice(6)
    else if (a.startsWith('--timeout=')) out.timeout = Number(a.slice(10)) || out.timeout
    else if (a === '--insecure') out.insecure = true
    else if (!a.startsWith('--') && !out.url) out.url = a
  }
  return out
}

function parseInfo(infoText) {
  const map = {}
  const lines = String(infoText || '').split(/\r?\n/)
  for (const ln of lines) {
    if (!ln || ln.startsWith('#')) continue
    const i = ln.indexOf(':')
    if (i > 0) {
      const k = ln.slice(0, i)
      const v = ln.slice(i + 1)
      map[k] = v
    }
  }
  return map
}

(async () => {
  const { url, timeout, insecure } = parseArgs()
  if (!url) {
    console.error('[test-redis] Missing URL. Provide --url=... or set REDIS_URL env.')
    console.error('Example:')
    console.error('  REDIS_URL=redis://localhost:6379 node scripts/test-redis.js')
    console.error('  node scripts/test-redis.js --url=rediss://user:pass@host:6380 --timeout=3000 --insecure')
    process.exit(1)
  }

  let createClient
  try {
    ({ createClient } = await import('redis'))
  } catch (e) {
    console.error('[test-redis] Failed to load redis client. Run `npm i redis` first.')
    console.error(e)
    process.exit(1)
  }

  const isTLS = url.startsWith('rediss://')
  const client = createClient({
    url,
    socket: Object.assign(
      {
        connectTimeout: timeout,
        // Keep reconnect attempts minimal for the test script
        reconnectStrategy: () => 0,
      },
      isTLS && insecure ? { tls: true, rejectUnauthorized: false } : {}
    ),
  })

  client.on('error', (err) => {
    console.error('[redis] client error:', err?.message || err)
  })

  console.log(`[test-redis] Connecting to ${url} (timeout ${timeout}ms${isTLS ? insecure ? ', TLS insecure' : ', TLS' : ''})`)
  const t0 = Date.now()
  try {
    await client.connect()
  } catch (e) {
    const m = e && e.message || String(e)
    console.error('[test-redis] Connect failed:', m)
    if (e && (e.code || e.errno || e.syscall)) {
      console.error('  code:', e.code, 'errno:', e.errno, 'syscall:', e.syscall)
    }
    process.exit(2)
  }
  console.log(`[test-redis] Connected in ${Date.now() - t0} ms`)

  // PING latency
  try {
    const p0 = Date.now()
    const pong = await client.ping()
    console.log(`[test-redis] PING -> ${pong} (${Date.now() - p0} ms)\n`)
  } catch (e) {
    console.error('[test-redis] PING failed:', e?.message || e)
  }

  // INFO snapshot
  try {
    const info = await client.info()
    const m = parseInfo(info)
    console.log('[test-redis] INFO snapshot:')
    const fields = [
      'redis_version', 'tcp_port', 'tls_port',
      'role', 'connected_clients', 'used_memory_human', 'maxmemory_human',
      'cluster_enabled', 'redis_mode'
    ]
    const out = {}
    for (const k of fields) if (m[k] != null) out[k] = m[k]
    console.log(out)
  } catch (e) {
    console.error('[test-redis] INFO failed:', e?.message || e)
  }

  // Small SET/GET round-trip
  try {
    const key = `test:conn:${Date.now()}`
    await client.setEx(key, 10, 'ok')
    const val = await client.get(key)
    console.log(`[test-redis] SET/GET ok -> ${key} = ${val}`)
  } catch (e) {
    console.error('[test-redis] SET/GET failed:', e?.message || e)
  }

  try { await client.quit() } catch {}
  process.exit(0)
})()

