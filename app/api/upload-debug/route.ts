import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateSessionId } from '../../../lib/session'

export async function POST(request: NextRequest) {
  try {
    console.log('DEBUG: Upload request started')
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      console.log('DEBUG: No file uploaded')
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    console.log('DEBUG: File details:', {
      name: file.name,
      size: file.size,
      type: file.type
    })

    // Create upload session record
    const sessionId = generateSessionId()
    console.log('DEBUG: Generated sessionId:', sessionId)
    
    // Safe table name generation to prevent SQL injection
    const tempTableName = `temp_ad_data_${sessionId.replace(/[^a-zA-Z0-9_]/g, '_')}`
    console.log('DEBUG: Generated tempTableName:', tempTableName)
    
    // Validate table name format
    if (!/^[a-zA-Z_][a-zA-Z0-9_]{1,60}$/.test(tempTableName)) {
      console.log('DEBUG: Invalid table name format')
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 })
    }
    
    console.log('DEBUG: Creating upload session in database...')
    const uploadSession = await prisma.uploadSession.create({
      data: {
        id: sessionId,
        filename: file.name,
        fileSize: file.size,
        tempTableName,
        status: 'uploading'
      }
    })
    console.log('DEBUG: Upload session created:', uploadSession)
    
    // Test table creation
    console.log('DEBUG: Creating temporary table...')
    await prisma.$executeRawUnsafe(`
      CREATE UNLOGGED TABLE ${tempTableName} (
        id SERIAL PRIMARY KEY,
        dataDate DATE,
        website VARCHAR(500),
        country VARCHAR(100),
        adFormat VARCHAR(200),
        adUnit VARCHAR(500),
        advertiser VARCHAR(500),
        domain VARCHAR(500),
        device VARCHAR(100),
        browser VARCHAR(100),
        requests BIGINT,
        impressions BIGINT,
        clicks BIGINT,
        ctr DECIMAL(10, 4),
        ecpm DECIMAL(15, 6),
        revenue DECIMAL(15, 6),
        viewableImpressions BIGINT,
        viewabilityRate DECIMAL(10, 4),
        measurableImpressions BIGINT,
        fillRate DECIMAL(10, 4),
        arpu DECIMAL(15, 6)
      )
    `)
    console.log('DEBUG: Temporary table created successfully')

    return NextResponse.json({
      sessionId,
      filename: file.name,
      tempTableName,
      message: 'Debug test successful'
    })
    
  } catch (error) {
    console.error('DEBUG: Upload error:', error)
    return NextResponse.json(
      { error: 'Upload failed', details: (error instanceof Error ? error.message : String(error)), stack: error.stack },
      { status: 500 }
    )
  }
}