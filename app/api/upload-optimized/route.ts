import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createInterface } from 'readline';

const UPLOAD_DIR = './uploads';
const RESULTS_DIR = './results';
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

export async function POST(request: NextRequest) {
  try {
    // 确保目录存在
    await mkdir(UPLOAD_DIR, { recursive: true });
    await mkdir(RESULTS_DIR, { recursive: true });

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: '没有找到文件' }, { status: 400 });
    }

    // 检查文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '文件过大，请上传小于200MB的文件' },
        { status: 400 }
      );
    }

    // 检查文件类型
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: '只支持CSV格式文件' },
        { status: 400 }
      );
    }

    const fileId = crypto.randomUUID();
    const fileName = `${fileId}${file.name.endsWith('.csv') ? '' : '.csv'}`;
    const filePath = join(UPLOAD_DIR, fileName);

    // 保存上传的文件
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, fileBuffer);

    // 创建状态文件
    const statusPath = join(RESULTS_DIR, `${fileId}.status`);
    await writeFile(statusPath, JSON.stringify({
      status: 'processing',
      fileName: file.name,
      fileSize: file.size,
      uploadTime: new Date().toISOString(),
      progress: 0
    }));

    // 异步处理文件（不等待）
    processFile(fileId, filePath, statusPath).catch(console.error);

    return NextResponse.json({
      fileId,
      message: '文件上传成功，正在分析中...',
      fileName: file.name,
      fileSize: file.size
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: '文件上传失败' },
      { status: 500 }
    );
  }
}

async function processFile(fileId: string, filePath: string, statusPath: string) {
  try {
    const stream = createReadStream(filePath);
    const rl = createInterface({
      input: stream,
      crlfDelay: Infinity,
      terminal: false
    });

    // 聚合器
    const aggregator = {
      summary: {
        totalRows: 0,
        totalRevenue: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalRequests: 0,
        avgEcpm: 0,
        avgCtr: 0
      },
      websites: new Map<string, {
        revenue: number;
        impressions: number;
        clicks: number;
        requests: number;
      }>(),
      countries: new Map<string, {
        revenue: number;
        impressions: number;
        clicks: number;
        requests: number;
      }>(),
      dates: new Map<string, {
        revenue: number;
        impressions: number;
        clicks: number;
        requests: number;
      }>(),
      devices: new Map<string, {
        revenue: number;
        impressions: number;
        clicks: number;
        requests: number;
      }>(),
      adFormats: new Map<string, {
        revenue: number;
        impressions: number;
        clicks: number;
        requests: number;
      }>(),
      sampleData: [] as any[]
    };

    let lineCount = 0;
    let processedLines = 0;

    for await (const line of rl) {
      if (lineCount === 0) {
        lineCount++;
        continue; // 跳过标题行
      }

      // 快速解析CSV
      const cols = line.split(',');
      if (cols.length < 17) continue;

      try {
        const website = cols[0]?.trim() || 'Unknown';
        const country = cols[1]?.trim() || 'Unknown';
        const adFormat = cols[2]?.trim() || 'Unknown';
        const device = cols[6]?.trim() || 'Unknown';
        const date = cols[8]?.trim();
        const requests = parseInt(cols[9]) || 0;
        const impressions = parseInt(cols[10]) || 0;
        const clicks = parseInt(cols[11]) || 0;
        const revenue = parseFloat(cols[14]) || 0;

        // 更新汇总数据
        aggregator.summary.totalRevenue += revenue;
        aggregator.summary.totalImpressions += impressions;
        aggregator.summary.totalClicks += clicks;
        aggregator.summary.totalRequests += requests;

        // 聚合数据
        updateAggregator(aggregator.websites, website, { revenue, impressions, clicks, requests });
        updateAggregator(aggregator.countries, country, { revenue, impressions, clicks, requests });
        if (date) updateAggregator(aggregator.dates, date, { revenue, impressions, clicks, requests });
        updateAggregator(aggregator.devices, device, { revenue, impressions, clicks, requests });
        updateAggregator(aggregator.adFormats, adFormat, { revenue, impressions, clicks, requests });

        // 保存样本数据（限制3000行）
        if (aggregator.sampleData.length < 3000) {
          aggregator.sampleData.push({
            website,
            country,
            adFormat,
            device,
            date,
            requests,
            impressions,
            clicks,
            ctr: impressions > 0 ? (clicks / impressions * 100) : 0,
            ecpm: impressions > 0 ? (revenue / impressions * 1000) : 0,
            revenue
          });
        }

        processedLines++;

        // 每10万行更新进度并强制GC
        if (processedLines % 100000 === 0) {
          const progress = Math.min(95, Math.floor((processedLines / 500000) * 100));
          await updateStatus(statusPath, { progress, processedLines });
          
          if (global.gc) {
            global.gc();
          }
        }
      } catch (e) {
        console.warn('Error processing line:', lineCount, e);
      }

      lineCount++;
    }

    // 计算最终结果
    aggregator.summary.totalRows = processedLines;
    aggregator.summary.avgEcpm = aggregator.summary.totalImpressions > 0 
      ? (aggregator.summary.totalRevenue / aggregator.summary.totalImpressions) * 1000 
      : 0;
    aggregator.summary.avgCtr = aggregator.summary.totalImpressions > 0
      ? (aggregator.summary.totalClicks / aggregator.summary.totalImpressions * 100)
      : 0;

    // 处理聚合数据
    const result = {
      fileId,
      fileName: filePath.split('/').pop(),
      summary: aggregator.summary,
      topWebsites: getTopItems(aggregator.websites, 20),
      topCountries: getTopItems(aggregator.countries, 20),
      dailyTrend: Object.entries(aggregator.dates)
        .map(([date, data]: [string, any]) => ({
          date,
          ...data,
          avgEcpm: data.impressions > 0 ? (data.revenue / data.impressions * 1000) : 0,
          ctr: data.impressions > 0 ? (data.clicks / data.impressions * 100) : 0
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      devices: getTopItems(aggregator.devices, 10),
      adFormats: getTopItems(aggregator.adFormats, 10),
      sampleData: aggregator.sampleData,
      processedAt: new Date().toISOString()
    };

    // 保存结果
    const resultPath = join(RESULTS_DIR, `${fileId}.json`);
    await writeFile(resultPath, JSON.stringify(result, null, 2));

    // 更新状态为完成
    await updateStatus(statusPath, {
      status: 'completed',
      progress: 100,
      processedLines,
      completedAt: new Date().toISOString(),
      resultPath
    });

    // 清理大Map
    aggregator.websites.clear();
    aggregator.countries.clear();
    aggregator.dates.clear();
    aggregator.devices.clear();
    aggregator.adFormats.clear();

    console.log(`File ${fileId} processed successfully. ${processedLines} rows.`);

  } catch (error) {
    console.error('Processing error:', error);
    await updateStatus(statusPath, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      failedAt: new Date().toISOString()
    });
  }
}

function updateAggregator(
  map: Map<string, any>,
  key: string,
  data: { revenue: number; impressions: number; clicks: number; requests: number }
) {
  const current = map.get(key) || { revenue: 0, impressions: 0, clicks: 0, requests: 0 };
  current.revenue += data.revenue;
  current.impressions += data.impressions;
  current.clicks += data.clicks;
  current.requests += data.requests;
  map.set(key, current);
}

function getTopItems(map: Map<string, any>, limit: number) {
  return Array.from(map.entries())
    .map(([name, data]: [string, any]) => ({
      name,
      ...data,
      avgEcpm: data.impressions > 0 ? (data.revenue / data.impressions * 1000) : 0,
      ctr: data.impressions > 0 ? (data.clicks / data.impressions * 100) : 0
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

async function updateStatus(statusPath: string, data: any) {
  try {
    const currentStatus = JSON.parse(await readFile(statusPath, 'utf-8'));
    await writeFile(statusPath, JSON.stringify({ ...currentStatus, ...data }, null, 2));
  } catch (error) {
    console.error('Error updating status:', error);
  }
}