// ANSI color codes — no chalk dependency to keep bundle small
const RED = '\x1b[31m'
const RESET = '\x1b[0m'

let colorEnabled = true

export function disableColor(): void {
  colorEnabled = false
}

function red(text: string): string {
  if (!colorEnabled || !process.stdout.isTTY) return text
  return `${RED}${text}${RESET}`
}

export type OutputMode = 'tty' | 'json' | 'quiet'

export interface OutputOptions {
  json?: boolean
  quiet?: boolean
  format?: 'auto' | 'table' | 'json'
  jq?: string
  color?: boolean
}

export function detectOutputMode(options: OutputOptions): OutputMode {
  if (options.quiet) return 'quiet'
  // An explicit --format/--json wins over auto-detection; otherwise (auto/unset)
  // fall back to JSON when output is piped (non-TTY) and a human table when
  // attached to a terminal — the gh/clig.dev "machine-readable when not a TTY" rule.
  if (options.format === 'json' || options.json) return 'json'
  if (options.format === 'table') return 'tty'
  if (!process.stdout.isTTY) return 'json'
  return 'tty'
}

export function formatOutput(data: unknown, mode: OutputMode): string {
  if (mode === 'quiet') return ''
  if (mode === 'json') return JSON.stringify(data, null, 2)
  // tty: pretty-print objects or stringify primitives
  if (typeof data === 'string') return data
  return JSON.stringify(data, null, 2)
}

export function formatTable(
  rows: Record<string, unknown>[],
  columns?: string[],
): string {
  if (rows.length === 0) return ''

  const cols = columns ?? Object.keys(rows[0]!)
  const widths: number[] = cols.map((col) => col.length)

  // Compute max widths
  for (const row of rows) {
    for (let i = 0; i < cols.length; i++) {
      const val = String(row[cols[i]!] ?? '')
      if (val.length > widths[i]!) widths[i] = val.length
    }
  }

  const pad = (s: string, w: number) => s.padEnd(w, ' ')
  const separator = widths.map((w) => '-'.repeat(w)).join('  ')

  const header = cols.map((c, i) => pad(c.toUpperCase(), widths[i]!)).join('  ')
  const dataRows = rows.map((row) =>
    cols.map((c, i) => pad(String(row[c] ?? ''), widths[i]!)).join('  '),
  )

  return [header, separator, ...dataRows].join('\n')
}

export function formatError(error: Error | string, mode: OutputMode): string {
  const message = error instanceof Error ? error.message : error
  if (mode === 'tty') return red(`Error: ${message}`)
  // json and quiet both return JSON error — errors always show
  return JSON.stringify({ error: message }, null, 2)
}

type JqOp = { type: 'prop'; name: string } | { type: 'iter' } | { type: 'index'; n: number }

// ponytail: minimal jq subset — `.`, `.a.b`, `.[]`, `.foo[]`, `.[0]`, and any
// chain of those (covers the `.[].id` / `.field` cases the scripting ICP pipes).
// NOT real jq: no pipes, filters, functions, or object construction. If users
// need those, add the `jaq`/`node-jq` dependency and delegate — don't grow this.
function parseJq(expr: string): JqOp[] {
  const e = expr.trim()
  if (e === '' || e === '.') return []
  if (!e.startsWith('.')) {
    throw new Error(`--jq: expression must start with "." (got "${expr}")`)
  }
  const body = e.slice(1)
  const ops: JqOp[] = []
  let i = 0
  while (i < body.length) {
    const ch = body[i]!
    if (ch === '.') {
      i++
      continue
    }
    if (ch === '[') {
      const close = body.indexOf(']', i)
      if (close === -1) throw new Error(`--jq: unclosed "[" in "${expr}"`)
      const inner = body.slice(i + 1, close).trim()
      if (inner === '') {
        ops.push({ type: 'iter' })
      } else {
        const n = Number(inner)
        if (!Number.isInteger(n)) throw new Error(`--jq: invalid index "[${inner}]" in "${expr}"`)
        ops.push({ type: 'index', n })
      }
      i = close + 1
      continue
    }
    const m = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(body.slice(i))
    if (!m) throw new Error(`--jq: unexpected character "${ch}" in "${expr}"`)
    ops.push({ type: 'prop', name: m[0] })
    i += m[0].length
  }
  return ops
}

/**
 * Applies a minimal jq-subset expression to a value, returning the output stream
 * (one entry per produced value). Throws on a malformed expression or an op that
 * doesn't fit the value (e.g. iterating a scalar) so callers exit non-zero.
 */
export function applyJq(data: unknown, expr: string): unknown[] {
  const ops = parseJq(expr)
  let stream: unknown[] = [data]
  for (const op of ops) {
    const next: unknown[] = []
    for (const v of stream) {
      if (op.type === 'prop') {
        next.push(v == null ? null : ((v as Record<string, unknown>)[op.name] ?? null))
      } else if (op.type === 'index') {
        if (!Array.isArray(v)) throw new Error(`--jq: cannot index non-array with [${op.n}]`)
        const idx = op.n < 0 ? v.length + op.n : op.n
        next.push(v[idx] ?? null)
      } else {
        if (Array.isArray(v)) next.push(...v)
        else if (v && typeof v === 'object') next.push(...Object.values(v))
        else throw new Error(`--jq: cannot iterate over ${v === null ? 'null' : typeof v} — .[] needs an array or object`)
      }
    }
    stream = next
  }
  return stream
}

/** Renders a jq output stream: raw strings (unquoted, for piping), JSON for the rest. */
export function formatJq(data: unknown, expr: string): string {
  return applyJq(data, expr)
    .map((r) => (typeof r === 'string' ? r : r === undefined ? 'null' : JSON.stringify(r)))
    .join('\n')
}
