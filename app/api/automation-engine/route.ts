import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
  try {
    // Get simple current metrics
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const currentStats = await prisma.adReport.aggregate({
      where: {
        dataDate: {
          gte: today
        }
      },
      _avg: {
        fillRate: true,
        ecpm: true
      },
      _sum: {
        revenue: true
      }
    })
    
    // Define automation rules
    const rules = [
      {
        id: 'low-fill-rate',
        name: '低填充率自动调价',
        condition: (currentStats._avg.fillRate || 0) < 30,
        action: 'decrease_floor_price_20',
        recommendation: `检测到平均填充率仅为 ${(currentStats._avg.fillRate || 0).toFixed(1)}%，建议降低底价20%以提高填充率`
      },
      {
        id: 'revenue-check',
        name: '收入检查',
        condition: (currentStats._sum.revenue || 0) > 50,
        action: 'monitor_performance',
        recommendation: '今日收入表现良好，建议继续监控'
      }
    ]
    
    // Check which rules are triggered
    const triggeredRules = automationRules.map(rule => ({
      rule,
      triggered: 
        (rule.id === 'low-fill-rate' && (currentStats._avg.fillRate || 0) < 30) ||
        (rule.id === 'high-ecpm-opportunity' && (currentStats._avg.ecpm || 0) > 20) ||
        (rule.id === 'revenue-anomaly' && (currentStats._sum.revenue || 0) > 0 && 
         Math.abs((currentStats._sum.revenue || 0) - (currentStats._avg.ecpm || 0) * 1000) > (currentStats._sum.revenue || 0) * 0.5), // Check for significant deviation
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
    
    return NextResponse.json({
      rules: triggeredRules,
      actions,
      summary: {
        totalRules: automationRules.length,
        enabledRules: automationRules.filter(r => r.enabled).length,
        triggeredRules: triggeredRules.filter(tr => tr.triggered).length,
        currentMetrics: {
          avgFillRate: currentStats._avg.fillRate,
          avgEcpm: currentStats._avg.ecpm,
          totalRevenue: currentStats._sum.revenue
        },
        timestamp: new Date().toISOString()
      }
    })
    
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
      return `检测到填充率为 ${(stats._avg.fillRate || 0).toFixed(1)}%，建议降低底价20%以提高填充率`
    case 'high-ecpm-opportunity':
      return `发现高eCPM机会 ($${(stats._avg.ecpm || 0).toFixed(2)})，建议增加广告库存`
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