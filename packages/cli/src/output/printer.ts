import { type OutputMode, type OutputOptions, formatOutput, formatTable, formatError, detectOutputMode } from './formatter.js'
import { createSpinner, type Spinner } from './spinner.js'

export class Printer {
  constructor(private mode: OutputMode) {}

  log(data: unknown): void {
    const out = formatOutput(data, this.mode)
    if (out !== '') console.log(out)
  }

  table(rows: Record<string, unknown>[], columns?: string[]): void {
    if (this.mode === 'quiet') return
    if (this.mode === 'json') {
      console.log(formatOutput(rows, 'json'))
      return
    }
    const out = formatTable(rows, columns)
    if (out !== '') console.log(out)
  }

  error(err: Error | string): void {
    const out = formatError(err, this.mode)
    console.error(out)
  }

  spinner(message: string): Spinner {
    const s = createSpinner(this.mode)
    s.start(message)
    return s
  }
}

export function createPrinter(options: OutputOptions): Printer {
  const mode = detectOutputMode(options)
  return new Printer(mode)
}
