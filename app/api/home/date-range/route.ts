import { NextResponse } from 'next/server'
import { prismaRead } from '@/lib/prisma-extended'

export async function GET() {
  try {
    const rows: any[] = await (prismaRead as any).$queryRawUnsafe(`SELECT MIN("dataDate")::date AS min, MAX("dataDate")::date AS max FROM "AdReport"`)
    const min: Date | null = rows?.[0]?.min || null
    const max: Date | null = rows?.[0]?.max || null
    const iso = (d: Date|null) => d ? new Date(d).toISOString().slice(0,10) : null
    return NextResponse.json({ ok: true, min: iso(min), max: iso(max) })
  } catch (e) {
    console.error('home/date-range error:', e)
    const today = new Date().toISOString().slice(0,10)
    return NextResponse.json({ ok: true, min: today, max: today })
  }
}

