const FORBIDDEN = /(;|--|\/\*|\*\/|\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE|COPY|CALL|EXECUTE|PREPARE|LISTEN|NOTIFY)\b)/i

export function validateSelectOnly(sql: string): { ok: boolean; error?: string } {
  // 忽略结尾分号，避免误判，仅允许单条 SELECT 或 WITH 开头的只读 CTE 查询
  const trimmed = sql.trim().replace(/;\s*$/,'')
  if (!/^(select|with)\s+/i.test(trimmed)) {
    return { ok: false, error: '只允许以 SELECT 开头的只读查询' }
  }
  if (FORBIDDEN.test(trimmed)) {
    return { ok: false, error: '查询中包含禁止的关键字或分隔符' }
  }
  if (trimmed.length > 10000) {
    return { ok: false, error: 'SQL 过长' }
  }
  return { ok: true }
}

function escapeLiteral(val: string): string {
  return `'${val.replace(/'/g, "''")}'`
}

// 简单的命名参数绑定：:from, :to, :site，仅替换字面量，避免注入
export function bindNamedParams(sql: string, params: { from?: string; to?: string; site?: string }): string {
  // 去除结尾分号，保证单条查询
  let out = sql.replace(/;\s*$/,'')
  if (params.from) out = out.replace(/:from\b/g, escapeLiteral(params.from))
  // 若 :to 仅为日期，自动扩展到当日 23:59:59.999，保证包含整日数据（BETWEEN 闭区间）
  if (params.to) {
    const to = params.to
    const toEod = /^\d{4}-\d{2}-\d{2}$/.test(to)
      ? `${to} 23:59:59.999`
      : to
    out = out.replace(/:to\b/g, escapeLiteral(toEod))
  }
  if (params.site) out = out.replace(/:site\b/g, escapeLiteral(params.site))
  return out
}
