// lib/analytics-batch.ts
import { prisma } from '@/lib/prisma';

export interface AnalyticsSummary {
  totalRevenue: number;
  totalImpressions: number;
  totalRequests: number;
  avgFillRate: number;
  avgEcpm: number;
  byDate: Array<{ date: string; revenue: number }>;
  byCountry: Array<{ country: string; revenue: number }>;
  byDevice: Array<{ device: string; revenue: number }>;
}

export async function getAnalyticsByBatch(sessionId: string): Promise<AnalyticsSummary> {
  const batchSize = 20000; // 每批2万行
  let offset = 0;
  
  const summary = {
    totalRevenue: 0,
    totalImpressions: 0,
    totalRequests: 0,
    byDate: new Map<string, number>(),
    byCountry: new Map<string, number>(),
    byDevice: new Map<string, number>()
  };
  
  // 用于计算ecpm
  let totalEcpm = 0;
  let ecpmCount = 0;
  
  while (true) {
    const batch = await prisma.adReport.findMany({
      where: { sessionId },
      take: batchSize,
      skip: offset,
      select: {
        dataDate: true,
        revenue: true,
        impressions: true,
        requests: true,
        country: true,
        device: true,
        ecpm: true
      }
    });
    
    if (batch.length === 0) break;
    
    // 累加统计
    for (const record of batch) {
      summary.totalRevenue += Number(record.revenue || 0);
      summary.totalImpressions += Number(record.impressions || 0);
      summary.totalRequests += Number(record.requests || 0);
      
      // ECPM统计
      if (record.ecpm) {
        totalEcpm += record.ecpm;
        ecpmCount++;
      }
      
      // 按日期汇总
      const dateKey = record.dataDate.toISOString().split('T')[0];
      summary.byDate.set(dateKey, (summary.byDate.get(dateKey) || 0) + Number(record.revenue || 0));
      
      // 按国家汇总
      if (record.country) {
        summary.byCountry.set(record.country, (summary.byCountry.get(record.country) || 0) + Number(record.revenue || 0));
      }
      
      // 按设备汇总
      if (record.device) {
        summary.byDevice.set(record.device, (summary.byDevice.get(record.device) || 0) + Number(record.revenue || 0));
      }
    }
    
    offset += batchSize;
    
    // 避免阻塞事件循环
    if (batch.length === batchSize) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }
  
  // 转换为数组并排序
  return {
    totalRevenue: summary.totalRevenue,
    totalImpressions: summary.totalImpressions,
    totalRequests: summary.totalRequests,
    avgFillRate: summary.totalRequests ? (summary.totalImpressions / summary.totalRequests) * 100 : 0,
    avgEcpm: ecpmCount ? totalEcpm / ecpmCount : 0,
    byDate: Array.from(summary.byDate.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    byCountry: Array.from(summary.byCountry.entries())
      .map(([country, revenue]) => ({ country, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10), // 只取前10
    byDevice: Array.from(summary.byDevice.entries())
      .map(([device, revenue]) => ({ device, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10) // 只取前10
  };
}