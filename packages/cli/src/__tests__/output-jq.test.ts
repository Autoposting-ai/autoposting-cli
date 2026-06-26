import { describe, it, expect } from 'vitest'
import { applyJq, formatJq } from '../output/formatter.js'

const POSTS = [
  { id: 'a1', status: 'scheduled', meta: { score: 9 } },
  { id: 'b2', status: 'draft', meta: { score: 5 } },
]

describe('applyJq', () => {
  it('. is identity', () => {
    expect(applyJq(POSTS, '.')).toEqual([POSTS])
  })

  it('.[] iterates an array', () => {
    expect(applyJq(POSTS, '.[]')).toEqual(POSTS)
  })

  it('.[].id extracts a field from each element', () => {
    expect(applyJq(POSTS, '.[].id')).toEqual(['a1', 'b2'])
  })

  it('.field reads a top-level property', () => {
    expect(applyJq({ id: 'x' }, '.id')).toEqual(['x'])
  })

  it('.a.b reads a nested property', () => {
    expect(applyJq({ a: { b: 7 } }, '.a.b')).toEqual([7])
  })

  it('.[N] indexes an array', () => {
    expect(applyJq(POSTS, '.[1].id')).toEqual(['b2'])
  })

  it('negative index counts from the end', () => {
    expect(applyJq(['x', 'y', 'z'], '.[-1]')).toEqual(['z'])
  })

  it('.[] over object yields its values', () => {
    expect(applyJq({ a: 1, b: 2 }, '.[]')).toEqual([1, 2])
  })

  it('chains iterate + nested field', () => {
    expect(applyJq(POSTS, '.[].meta.score')).toEqual([9, 5])
  })

  it('missing property yields null (jq-like)', () => {
    expect(applyJq({ id: 'x' }, '.nope')).toEqual([null])
  })

  it('throws on an expression not starting with "."', () => {
    expect(() => applyJq(POSTS, 'id')).toThrow(/must start with/)
  })

  it('throws on unclosed bracket', () => {
    expect(() => applyJq(POSTS, '.[')).toThrow(/unclosed/)
  })

  it('throws when iterating a scalar', () => {
    expect(() => applyJq(5, '.[]')).toThrow(/cannot iterate/)
  })

  it('throws on indexing a non-array', () => {
    expect(() => applyJq({ a: 1 }, '.[0]')).toThrow(/cannot index/)
  })
})

describe('formatJq', () => {
  it('prints raw (unquoted) strings one per line', () => {
    expect(formatJq(POSTS, '.[].id')).toBe('a1\nb2')
  })

  it('prints non-strings as JSON', () => {
    expect(formatJq(POSTS, '.[].meta')).toBe('{"score":9}\n{"score":5}')
  })

  it('prints numbers verbatim', () => {
    expect(formatJq(POSTS, '.[].meta.score')).toBe('9\n5')
  })
})
