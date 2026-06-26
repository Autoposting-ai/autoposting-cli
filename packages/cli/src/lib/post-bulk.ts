import fs from 'node:fs'
import type { Autoposting } from '@autoposting.ai/sdk'
import { resolveBrand } from '../auth/config-store.js'
import { buildAndCreatePost, type PostFields } from './post-create.js'

export interface BulkRecordResult {
  index: number
  status: 'created' | 'failed'
  id: string
  text: string
  error: string
}

/**
 * Parse a bulk input file into an array of raw post rows. JSON (an array of
 * post objects) is lossless — array fields like `media`/`thread` pass straight
 * through. CSV is for flat rows; see parseCsvRows for its ceiling.
 */
export function parseBulkFile(filePath: string): Record<string, unknown>[] {
  const raw = fs.readFileSync(filePath, 'utf8')
  const isJson = filePath.toLowerCase().endsWith('.json') || raw.trimStart().startsWith('[')
  const rows = isJson ? parseJsonRows(raw) : parseCsvRows(raw)
  if (rows.length === 0) {
    throw new Error(`No records found in ${filePath}.`)
  }
  return rows
}

function parseJsonRows(raw: string): Record<string, unknown>[] {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch (e) {
    throw new Error(`Invalid JSON bulk input: ${(e as Error).message}`)
  }
  if (!Array.isArray(data)) {
    throw new Error('JSON bulk input must be an array of post objects.')
  }
  return data as Record<string, unknown>[]
}

// ponytail: minimal CSV — comma separator, double-quote escaping ("" = literal
// quote), no newlines inside quoted cells. Multi-value fields (thread, media,
// account, alt-text) aren't expressible in flat CSV — use JSON for those.
function parseCsvRows(raw: string): Record<string, unknown>[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []
  const headers = splitCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line)
    const row: Record<string, unknown> = {}
    headers.forEach((h, i) => {
      if (cells[i] !== undefined && cells[i] !== '') row[h] = cells[i]
    })
    return row
  })
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') {
        inQuotes = false
      } else {
        cur += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

/** Build PostFields from one raw row, falling back to the CLI/context brand. */
function rowToFields(row: Record<string, unknown>, cliBrand?: string): PostFields {
  const platformsRaw = row.platforms
  const platforms = Array.isArray(platformsRaw) ? platformsRaw.join(',') : platformsRaw
  const brand = resolveBrand((row.brand as string) ?? (row.brandSlug as string) ?? cliBrand)
  if (!brand) {
    throw new Error('No brand: set "brand" in the row, pass --brand, or set a default context.')
  }
  if (!row.text) throw new Error('Missing "text".')
  if (!platforms) throw new Error('Missing "platforms".')
  // Array-typed fields can't be expressed in flat CSV (cells are always strings),
  // so a scalar here would misparse downstream (e.g. media.length = char count).
  // Reject with guidance instead of a confusing per-character failure.
  for (const key of ['media', 'thread', 'account', 'altText'] as const) {
    if (row[key] !== undefined && !Array.isArray(row[key])) {
      throw new Error(`"${key}" is multi-value — use a JSON input file with an array (CSV can't express it).`)
    }
  }
  return {
    ...(row as Partial<PostFields>),
    brandSlug: brand,
    text: String(row.text),
    platforms: String(platforms),
  }
}

/**
 * Create posts in bulk. Each row is independent — a failure is captured and the
 * loop continues — so the caller maps any failed record to a non-zero exit.
 * Runs non-interactively (no per-row account picker): a row whose platform has
 * multiple accounts and no selector fails fast and is reported.
 *
 * ponytail: no idempotency key — re-running a partially-failed batch re-creates
 * the rows that already succeeded. Split the file or de-dupe upstream to re-run.
 */
export async function createPostsBulk(
  client: Autoposting,
  rows: Record<string, unknown>[],
  opts: { cliBrand?: string } = {},
): Promise<BulkRecordResult[]> {
  const results: BulkRecordResult[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    try {
      const fields = rowToFields(row, opts.cliBrand)
      const created = (await buildAndCreatePost(client, fields, { isTty: false })) as { id?: string }
      results.push({ index: i, status: 'created', id: created?.id ?? '', text: fields.text, error: '' })
    } catch (err) {
      results.push({
        index: i,
        status: 'failed',
        id: '',
        text: String(row.text ?? ''),
        error: (err as Error).message,
      })
    }
  }
  return results
}
