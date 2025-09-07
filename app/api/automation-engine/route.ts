import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentSession } from '@/lib/session'
import { createClient } from 'redis'

// Redis connection manager
class RedisManager {
  private static instance: any = null
  
  static async getClient() {
    if (!this.instance) {
      try {
        this.instance = createClient({
          url: process.env.REDIS_URL || '',
          socket: {
            reconnectStrategy: (retries) => Math.min(retries * 50, 500),
            timeout: 5000
          }
        })
        
        await this.instance.ping()
      } catch (error) {
        console.error('Redis connection failed:', error)
        this.instance = null
        return {
          get: async () => null,
          set: async () => {},
          setex: async () => {},
          del: async () => {},
          keys: async () => []
        }
      }
    }
    return this.instance
  }
}

// Automation rules database simulation
const automationRules = [
  {
    id: 'low-fill-rate',
    name: '低填充率自动调价',
    condition: '当前填充率低于30%',
    enabled: true,
    lastTriggered: null
  },
  {
    id: 'high-ecpm-opportunity',
    name: '高eCPM机会识别',
    condition: '检测到eCPM超过$20的广告位',
    enabled: true,
    lastTriggered: '2025-01-15T14:30:00Z'
  },
  {
    id: 'revenue-anomaly',
    name: '收入异常检测',
    condition: '日收入波动超过50%',
    enabled: true,
    lastTriggered: null
  },
  {
    id: 'geographic-expansion',
    name: '地理扩张建议',
    condition: '发现高价值新市场',
    enabled: false,
    lastTriggered: null
  }
]

export async function GET(request: NextRequest) {
  const redis = await RedisManager.getClient()
  
  try {
    const session = getCurrentSession(request)
    if (!session) {
      return NextResponse.json({ 
        rules: [],
        actions: [],
        summary: {
          totalRules: 0,
          enabledRules: 0,
          triggeredRules: 0,
          currentMetrics: {},
          timestamp: new Date().toISOString()
        }
      })
    }
    
    // Get session info
    const sessionInfo = await getSessionInfo(session.id, redis)
    if (!sessionInfo) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    
    // Generate cache key
    const cacheKey = `automation:${session.id}:${new Date().toISOString().slice(0, 10)}`
    
    // Try cache first
    const cached = await redis.get(cacheKey)
    if (cached) {
      return NextResponse.json(JSON.parse(cached))
    }
    
    // Get simple current metrics
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const currentStatsResult = await prisma.$queryRawUnsafe(`
      SELECT 
        AVG(fillRate) as avg_fillRate,
        AVG(ecpm) as avg_ecpm,
        SUM(revenue) as total_revenue
      FROM ${sessionInfo.tempTableName}
      WHERE dataDate >= $1
    `, today.toISOString().split('T')[0]) as any[]
    
    const currentStats = currentStatsResult[0] || {
      avg_fillRate: 0,
      avg_ecpm: 0,
      total_revenue: 0
    }
    
    // Define automation rules
    const rules = [
      {
        id: 'low-fill-rate',
        name: '低填充率自动调价',
        condition: (currentStats.avg_fillRate || 0) < 30,
        action: 'decrease_floor_price_20',
        recommendation: `检测到平均填充率仅为 ${(currentStats.avg_fillRate || 0).toFixed(1)}%，建议降低底价20%以提高填充率`
      },
      {
        id: 'revenue-check',
        name: '收入检查',
        condition: (currentStats.total_revenue || 0) > 50,
        action: 'monitor_performance',
        recommendation: '今日收入表现良好，建议继续监控'
      }
    ]
    
    // Check which rules are triggered
    const triggeredRules = automationRules.map(rule => ({
      rule,
      triggered: 
        (rule.id === 'low-fill-rate' && (currentStats.avg_fillRate || 0) < 30) ||
        (rule.id === 'high-ecpm-opportunity' && (currentStats.avg_ecpm || 0) > 20) ||
        (rule.id === 'revenue-anomaly' && (currentStats.total_revenue || 0) > 0 && 
         Math.abs((currentStats.total_revenue || 0) - (currentStats.avg_ecpm || 0) * 1000) > (currentStats.total_revenue || 0) * 0.5), // Check for significant deviation
      recommendation: getRecommendation(rule.id, currentStats)
    }))
    
    // Generate actions based on triggered rules
    const actions = triggeredRules
      .filter(tr => tr.triggered && tr.rule.enabled)
      .map(tr => ({
        ruleId: tr.rule.id,
        ruleName: tr.rule.name,
        action: getActionForRule(tr.rule.id),
        recommendation: tr.recommendation,
        priority: tr.rule.id === 'low-fill-rate' ? 'HIGH' : 'MEDIUM',
        estimatedImpact: getImpactEstimate(tr.rule.id)
      }))
    
    const response = {
      rules: triggeredRules,
      actions,
      summary: {
        totalRules: automationRules.length,
        enabledRules: automationRules.filter(r => r.enabled).length,
        triggeredRules: triggeredRules.filter(tr => tr.triggered).length,
        currentMetrics: {
          avgFillRate: currentStats.avg_fillRate,
          avgEcpm: currentStats.avg_ecpm,
          totalRevenue: currentStats.total_revenue
        },
        timestamp: new Date().toISOString()
      }
    }
    
    // Cache for 5 minutes (automation rules change frequently)
    try {
      await redis.setEx(cacheKey, 300, JSON.stringify(response))
    } catch (error) {
      console.error('Redis set failed:', error)
    }

    return NextResponse.json(response)
    
  } catch (error) {
    console.error('Automation engine error:', error)
    return NextResponse.json(
      { error: 'Failed to run automation engine' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ruleId, action, parameters } = await request.json()
    
    // Simulate action execution
    console.log(`Executing action ${action} for rule ${ruleId}`, parameters)
    
    // In a real implementation, this would:
    // 1. Validate the action
    // 2. Execute the appropriate optimization
    // 3. Log the execution
    // 4. Return results
    
    return NextResponse.json({
      success: true,
      message: `Action ${action} executed successfully`,
      ruleId,
      action,
      timestamp: new Date().toISOString(),
      result: {
        status: 'completed',
        changes: getActionChanges(action)
      }
    })
  } catch (error) {
    console.error('Action execution error:', error)
    return NextResponse.json(
      { error: 'Failed to execute action' },
      { status: 500 }
    )
  }
}

// Helper functions
function getRecommendation(ruleId: string, stats: any): string {
  switch (ruleId) {
    case 'low-fill-rate':
      return `检测到填充率为 ${(stats.avg_fillRate || 0).toFixed(1)}%，建议降低底价20%以提高填充率`
    case 'high-ecpm-opportunity':
      return `发现高eCPM机会 ($${(stats.avg_ecpm || 0).toFixed(2)})，建议增加广告库存`
    case 'revenue-anomaly':
      return '检测到收入异常，建议审查流量来源和广告配置'
    default:
      return '建议进一步分析'
  }
}

function getActionForRule(ruleId: string): string {
  switch (ruleId) {
    case 'low-fill-rate':
      return 'decrease_floor_price'
    case 'high-ecpm-opportunity':
      return 'increase_inventory'
    case 'revenue-anomaly':
      return 'investigate_anomaly'
    default:
      return 'review_configuration'
  }
}

function getImpactEstimate(ruleId: string): string {
  switch (ruleId) {
    case 'low-fill-rate':
      return '预期提升填充率15-25%'
    case 'high-ecpm-opportunity':
      return '预期增加收入10-20%'
    case 'revenue-anomaly':
      return '可能避免5-15%的收入损失'
    default:
      return '影响待评估'
  }
}

function getActionChanges(action: string): string[] {
  switch (action) {
    case 'decrease_floor_price':
      return ['底价降低20%', '填充率预期提升', '收入可能短期下降']
    case 'increase_inventory':
      return ['增加广告位库存', '优化广告投放策略', '监控填充率变化']
    case 'investigate_anomaly':
      return ['审查异常数据', '检查配置变更', '分析流量来源']
    default:
      return ['执行优化操作']
  }
}

async function getSessionInfo(sessionId: string, redis: any) {
  try {
    const cached = await redis.get(`session:${sessionId}`)
    if (cached) {
      return JSON.parse(cached)
    }
  } catch (error) {
    console.error('Redis get session failed:', error)
  }
  
  try {
    const session = await prisma.uploadSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        filename: true,
        recordCount: true,
        tempTableName: true,
        status: true
      }
    })
    
    if (session) {
      try {
        await redis.setEx(`session:${sessionId}`, 3600, JSON.stringify(session))
      } catch (error) {
        console.error('Redis set session failed:', error)
      }
    }
    
    return session
  } catch (error) {
    console.error('Database get session failed:', error)
    return null
  }
}