import { NextRequest, NextResponse } from 'next/server'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { CONFIG } from '@/lib/config'
import { prisma } from '@/lib/prisma-extended'
import { DBIngestionController } from '@/lib/db-importer'
import { logInfo, logError, timeStart } from '@/lib/logger'

export async function GET() {
  // 兼容性：如果带 sessionId 查询状态，这里可扩展；历史记录单独路由提供
  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  try {
    const end = timeStart('API/UPLOAD', 'upload-db')
    await mkdir(CONFIG.DIRECTORIES.UPLOAD_DIR, { recursive: true })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) { logError('API/UPLOAD', 'no file'); return NextResponse.json({ error: '未找到文件' }, { status: 400 }) }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({ error: '只支持CSV文件' }, { status: 415 })
    }

    const fileId = crypto.randomUUID()
    const fileName = `${fileId}-${file.name}`
    const filePath = join(CONFIG.DIRECTORIES.UPLOAD_DIR, fileName)
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, fileBuffer)
    logInfo('API/UPLOAD', 'file saved', { filePath, size: file.size })

    // 创建 UploadSession
    const session = await (prisma as any).uploadSession.create({
      data: {
        filename: file.name,
        status: 'uploading',
        tempTableName: `staging_${fileId.replace(/-/g, '')}`,
        fileSize: file.size,
        dataType: 'adx'
      }
    })
    logInfo('API/UPLOAD', 'session created', { sessionId: session.id, filename: file.name, size: file.size })

    // 入队 DB 导入（异步）
    DBIngestionController.getInstance().add(session.id, filePath, file.name, file.size)
    end(); logInfo('API/UPLOAD', 'queued', { sessionId: session.id })

    return NextResponse.json({
      ok: true,
      sessionId: session.id,
      fileName: file.name,
      fileSize: file.size
    })
  } catch (e) {
    logError('API/UPLOAD', 'upload-db error', e)
    return NextResponse.json({ error: '上传失败' }, { status: 500 })
  }
}
