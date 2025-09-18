import { prismaRead } from '@/lib/prisma-extended'
import UploadClient, { UploadHistoryItem } from '@/components/UploadClient'

export default async function UploadPage() {
  let initialHistory: UploadHistoryItem[] = []
  try {
    const items = await (prismaRead as any).uploadSession.findMany({
      orderBy: { uploadedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        filename: true,
        fileSize: true,
        status: true,
        recordCount: true,
        uploadedAt: true,
        processedAt: true,
        dataType: true,
        source: true,
        errorMessage: true,
      }
    })
    // 序列化日期
    initialHistory = items.map((x: any) => ({
      ...x,
      uploadedAt: new Date(x.uploadedAt).toISOString(),
      processedAt: x.processedAt ? new Date(x.processedAt).toISOString() : null,
    }))
  } catch (e) {
    // SSR 查询失败则返回空列表，前端会尝试API回退
    initialHistory = []
  }
  return <UploadClient initialHistory={initialHistory} />
}

