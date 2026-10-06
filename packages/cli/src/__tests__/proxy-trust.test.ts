import { createRequire } from 'node:module'
import { expect, it } from 'vitest'

const proxyAddr = createRequire(import.meta.url)('proxy-addr')

it('does not trust external IPv4 addresses through a short mapped IPv6 prefix', () => {
  expect(proxyAddr.compile('::ffff:10.0.0.0/8')('203.0.113.40')).toBe(false)
})

it('preserves correctly expressed private proxy subnet matching', () => {
  for (const subnet of ['10.0.0.0/8', '::ffff:10.0.0.0/104']) {
    const trust = proxyAddr.compile(subnet)
    expect(trust('10.1.2.3')).toBe(true)
    expect(trust('203.0.113.40')).toBe(false)
  }
})
