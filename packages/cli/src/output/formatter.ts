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
  format?: 'table' | 'json'
  color?: boolean
}

export function detectOutputMode(options: OutputOptions): OutputMode {
  if (options.quiet) return 'quiet'
  if (options.json || !process.stdout.isTTY) return 'json'
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
