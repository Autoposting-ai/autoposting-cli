import { describe, it, expect } from 'vitest'
import { createSpinner } from '../output/spinner.js'

describe('createSpinner', () => {
  it('returns a spinner with start/stop/fail methods in tty mode', () => {
    const spinner = createSpinner('tty')
    expect(typeof spinner.start).toBe('function')
    expect(typeof spinner.stop).toBe('function')
    expect(typeof spinner.fail).toBe('function')
  })

  it('returns no-op spinner in json mode (all methods callable without side effects)', () => {
    const spinner = createSpinner('json')
    expect(typeof spinner.start).toBe('function')
    expect(typeof spinner.stop).toBe('function')
    expect(typeof spinner.fail).toBe('function')
    // No-op — calling should not throw
    expect(() => spinner.start('loading...')).not.toThrow()
    expect(() => spinner.stop('done')).not.toThrow()
    expect(() => spinner.fail('failed')).not.toThrow()
  })

  it('returns no-op spinner in quiet mode (all methods callable without side effects)', () => {
    const spinner = createSpinner('quiet')
    expect(() => spinner.start('loading...')).not.toThrow()
    expect(() => spinner.stop()).not.toThrow()
    expect(() => spinner.fail('error')).not.toThrow()
  })

  it('no-op spinner stop accepts optional message', () => {
    const spinner = createSpinner('json')
    expect(() => spinner.stop()).not.toThrow()
    expect(() => spinner.stop('optional message')).not.toThrow()
  })
})
