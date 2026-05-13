import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  detectOutputMode,
  formatOutput,
  formatTable,
  formatError,
  type OutputOptions,
} from '../output/formatter.js'

describe('detectOutputMode', () => {
  const originalIsTTY = process.stdout.isTTY

  beforeEach(() => {
    // Reset isTTY before each test
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true })
  })

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
    })
  })

  it('returns tty when stdout.isTTY and no flags', () => {
    const opts: OutputOptions = {}
    expect(detectOutputMode(opts)).toBe('tty')
  })

  it('returns json when --json flag is set', () => {
    const opts: OutputOptions = { json: true }
    expect(detectOutputMode(opts)).toBe('json')
  })

  it('returns json when piped (not TTY)', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true })
    const opts: OutputOptions = {}
    expect(detectOutputMode(opts)).toBe('json')
  })

  it('returns quiet when --quiet flag is set', () => {
    const opts: OutputOptions = { quiet: true }
    expect(detectOutputMode(opts)).toBe('quiet')
  })

  it('quiet takes precedence over json flag', () => {
    const opts: OutputOptions = { quiet: true, json: true }
    expect(detectOutputMode(opts)).toBe('quiet')
  })
})

describe('formatOutput', () => {
  it('returns valid JSON string in json mode', () => {
    const data = { id: 1, name: 'test' }
    const result = formatOutput(data, 'json')
    expect(() => JSON.parse(result)).not.toThrow()
    expect(JSON.parse(result)).toEqual(data)
  })

  it('returns empty string in quiet mode', () => {
    expect(formatOutput({ any: 'data' }, 'quiet')).toBe('')
  })

  it('returns stringified data in tty mode for objects', () => {
    const data = { key: 'value' }
    const result = formatOutput(data, 'tty')
    expect(result).toContain('key')
    expect(result).toContain('value')
  })

  it('returns string as-is in tty mode', () => {
    expect(formatOutput('hello', 'tty')).toBe('hello')
  })
})

describe('formatTable', () => {
  const rows = [
    { name: 'Alice', role: 'admin', age: '30' },
    { name: 'Bob', role: 'viewer', age: '25' },
  ]

  it('formats rows into aligned columns', () => {
    const result = formatTable(rows)
    const lines = result.split('\n')
    // header + separator + 2 data rows = 4 lines
    expect(lines).toHaveLength(4)
    // header should be uppercase
    expect(lines[0]).toContain('NAME')
    expect(lines[0]).toContain('ROLE')
  })

  it('auto-detects columns from first row when not specified', () => {
    const result = formatTable(rows)
    expect(result).toContain('NAME')
    expect(result).toContain('ROLE')
    expect(result).toContain('AGE')
  })

  it('respects explicit column list', () => {
    const result = formatTable(rows, ['name', 'role'])
    expect(result).toContain('NAME')
    expect(result).toContain('ROLE')
    expect(result).not.toContain('AGE')
  })

  it('right-pads columns for alignment', () => {
    const result = formatTable(rows)
    const lines = result.split('\n')
    // All data lines should have equal length (padded)
    const dataLines = lines.slice(2)
    const lengths = dataLines.map((l) => l.length)
    expect(new Set(lengths).size).toBe(1)
  })

  it('returns empty string for empty rows array', () => {
    expect(formatTable([])).toBe('')
  })
})

describe('formatError', () => {
  it('returns JSON error object in json mode', () => {
    const result = formatError(new Error('something failed'), 'json')
    const parsed = JSON.parse(result)
    expect(parsed).toHaveProperty('error', 'something failed')
  })

  it('returns JSON error for string input in json mode', () => {
    const result = formatError('bad input', 'json')
    const parsed = JSON.parse(result)
    expect(parsed).toHaveProperty('error', 'bad input')
  })

  it('includes error message in tty mode', () => {
    const result = formatError(new Error('tty error'), 'tty')
    expect(result).toContain('tty error')
  })

  it('returns JSON error in quiet mode (errors always show)', () => {
    const result = formatError('quiet error', 'quiet')
    const parsed = JSON.parse(result)
    expect(parsed).toHaveProperty('error', 'quiet error')
  })
})
