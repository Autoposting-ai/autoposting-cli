import { type OutputMode, type OutputOptions, formatOutput, formatTable, formatError, formatJq, detectOutputMode } from './formatter.js'
import { createSpinner, type Spinner } from './spinner.js'

export class Printer {
  constructor(
    private mode: OutputMode,
    // When set, every log/table is run through the minimal jq filter instead of
    // the human/JSON renderer. A bad expression throws — caught by the command's
    // catch block, which prints the message and exits non-zero (no stack trace).
    private jq?: string,
  ) {}

  /** True only for human-readable output, where extra hint lines are safe to print. */
  isTty(): boolean {
    return this.mode === 'tty' && !this.jq
  }

  log(data: unknown): void {
    if (this.jq) return this.emitJq(data)
    const out = formatOutput(data, this.mode)
    if (out !== '') console.log(out)
  }

  table(rows: Record<string, unknown>[], columns?: string[]): void {
    if (this.jq) return this.emitJq(rows)
    if (this.mode === 'quiet') return
    if (this.mode === 'json') {
      console.log(formatOutput(rows, 'json'))
      return
    }
    const out = formatTable(rows, columns)
    if (out !== '') console.log(out)
  }

  private emitJq(data: unknown): void {
    // --jq implies machine output regardless of TTY; a bad expr throws here.
    const out = formatJq(data, this.jq!)
    if (out !== '') console.log(out)
  }

  error(err: Error | string): void {
    // Errors never run through jq — they go to stderr as plain/JSON per mode.
    const out = formatError(err, this.jq ? 'json' : this.mode)
    console.error(out)
  }

  spinner(message: string): Spinner {
    // A jq run is machine output — suppress the spinner so it can't leak into stdout.
    const s = createSpinner(this.jq ? 'json' : this.mode)
    s.start(message)
    return s
  }
}

export function createPrinter(options: OutputOptions): Printer {
  const mode = detectOutputMode(options)
  return new Printer(mode, options.jq)
}
