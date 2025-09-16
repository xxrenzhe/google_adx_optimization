const FORBIDDEN = /(;|--|\/\*|\*\/|\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE|COPY|CALL|EXECUTE|PREPARE|LISTEN|NOTIFY)\b)/i

export function validateSelectOnly(sql: string): { ok: boolean; error?: string } {
  const trimmed = sql.trim()
  if (!/^select\s+/i.test(trimmed)) {
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
  let out = sql
  if (params.from) out = out.replace(/:from\b/g, escapeLiteral(params.from))
  if (params.to) out = out.replace(/:to\b/g, escapeLiteral(params.to))
  if (params.site) out = out.replace(/:site\b/g, escapeLiteral(params.site))
  return out
}

