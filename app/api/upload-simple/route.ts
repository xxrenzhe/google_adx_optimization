import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    console.log('Upload request received')
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      console.log('No file uploaded')
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    console.log('File details:', {
      name: file.name,
      size: file.size,
      type: file.type
    })

    if (!file.name.endsWith('.csv')) {
      console.log('Not a CSV file')
      return NextResponse.json({ error: 'Only CSV files are allowed' }, { status: 400 })
    }

    // Simple test - just read the first few lines
    const text = await file.text()
    const lines = text.split('\n').slice(0, 5)
    
    console.log('First 5 lines:', lines)

    return NextResponse.json({
      message: 'File received successfully',
      filename: file.name,
      size: file.size,
      preview: lines
    })
    
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Upload failed', details: error.message },
      { status: 500 }
    )
  }
}