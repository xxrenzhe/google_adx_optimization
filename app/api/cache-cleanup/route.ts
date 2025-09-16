import { NextRequest, NextResponse } from 'next/server';
import { CONFIG } from '@/lib/config';
import { deleteByPrefix } from '@/lib/redis-cache';

export async function GET() {
  try {
    // 清理 Redis 缓存（短期结果缓存）
    const deleted = await deleteByPrefix('charts:') + await deleteByPrefix('report:summary:')

    return NextResponse.json({
      success: true,
      message: `缓存清理完成`,
      deletedKeys: deleted,
      cacheTtl: CONFIG.DATA_RETENTION.CLEANUP_INTERVAL_MS / 1000
    });

  } catch (error) {
    console.error('Cache cleanup error:', error);
    return NextResponse.json(
      { error: '缓存清理失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET();
}
