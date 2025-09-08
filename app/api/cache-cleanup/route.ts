import { NextRequest, NextResponse } from 'next/server';
import { CONFIG } from '@/lib/config';

export async function GET() {
  try {
    // 这里可以添加Redis缓存清理逻辑
    // 目前主要是为了兼容现有的cron job配置
    
    return NextResponse.json({
      success: true,
      message: `缓存清理完成`,
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