import type { OutputMode } from './formatter.js'

export interface Spinner {
  start(message: string): void
  stop(message?: string): void
  fail(message: string): void
}

// No-op spinner for JSON/quiet modes — no TTY output during machine-readable runs
const NO_OP_SPINNER: Spinner = {
  start: () => {},
  stop: () => {},
  fail: () => {},
}

// TTY spinner backed by ora (dynamic import for CJS compatibility)
class OraSpinner implements Spinner {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private instance: any = null

  start(message: string): void {
    import('ora').then(({ default: ora }) => {
      this.instance = ora(message).start()
    }).catch(() => {
      // ora unavailable — fall back to plain stdout
      process.stdout.write(`${message}\n`)
    })
  }

  stop(message?: string): void {
    if (this.instance) {
      this.instance.succeed(message)
      this.instance = null
    } else if (message) {
      process.stdout.write(`${message}\n`)
    }
  }

  fail(message: string): void {
    if (this.instance) {
      this.instance.fail(message)
      this.instance = null
    } else {
      process.stderr.write(`${message}\n`)
    }
  }
}

export function createSpinner(mode: OutputMode): Spinner {
  if (mode === 'tty') return new OraSpinner()
  return NO_OP_SPINNER
}
