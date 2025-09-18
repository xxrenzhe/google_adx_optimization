#!/usr/bin/env node
const { Client } = require('pg')

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const client = new Client({ connectionString: url })
  await client.connect()
  try {
    console.log('[DB-RESET] Connected. Dropping public schema...')
    await client.query('DROP SCHEMA IF EXISTS public CASCADE;')
    await client.query('CREATE SCHEMA public;')
    await client.query('GRANT ALL ON SCHEMA public TO public;')
    console.log('[DB-RESET] public schema recreated.')
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('[DB-RESET] failed:', e?.message || e)
  process.exit(1)
})

