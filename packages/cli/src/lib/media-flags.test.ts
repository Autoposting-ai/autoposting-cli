/**
 * Unit tests for media-flags.ts — PURE functions only, no network, no spawn.
 * These must run green in isolation (no SDK build required).
 */
import { describe, it, expect } from 'vitest'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import {
  extToMime,
  parsePairs,
  parsePlatformMediaPairs,
  validateMediaCount,
  validateMediaPaths,
  alignAltText,
  buildYoutubeOptions,
  buildInstagramOptions,
  buildThreadsOptions,
} from './media-flags.js'

// ---------------------------------------------------------------------------
// extToMime
// ---------------------------------------------------------------------------
describe('extToMime', () => {
  it.each([
    ['photo.jpg', 'image/jpeg'],
    ['photo.jpeg', 'image/jpeg'],
    ['image.png', 'image/png'],
    ['anim.gif', 'image/gif'],
    ['photo.webp', 'image/webp'],
    ['video.mp4', 'video/mp4'],
    ['clip.mov', 'video/quicktime'],
    ['clip.webm', 'video/webm'],
    ['PHOTO.JPG', 'image/jpeg'], // case-insensitive extension
  ])('%s → %s', (filename, expected) => {
    expect(extToMime(filename)).toBe(expected)
  })

  it('throws on unknown extension', () => {
    expect(() => extToMime('file.xyz')).toThrow(/unsupported file extension/i)
  })

  it('throws on missing extension', () => {
    expect(() => extToMime('noextension')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// parsePairs
// ---------------------------------------------------------------------------
describe('parsePairs', () => {
  it('parses valid platform=value pairs', () => {
    expect(parsePairs('--platform-text', ['x=Hello', 'linkedin=World'])).toEqual({
      x: 'Hello',
      linkedin: 'World',
    })
  })

  it('handles = in value (only first = is the separator)', () => {
    expect(parsePairs('--platform-text', ['x=a=b'])).toEqual({ x: 'a=b' })
  })

  it('throws on malformed pair (no =)', () => {
    expect(() => parsePairs('--platform-text', ['badformat'])).toThrow(
      /expected.*platform=value/i,
    )
  })

  it('throws on unknown platform', () => {
    expect(() => parsePairs('--platform-text', ['tiktok=hi'])).toThrow(/unknown platform/i)
  })

  it('includes the flag name in the error', () => {
    expect(() => parsePairs('--platform-text', ['bad'])).toThrow(/--platform-text/)
  })
})

// ---------------------------------------------------------------------------
// parsePlatformMediaPairs
// ---------------------------------------------------------------------------
describe('parsePlatformMediaPairs', () => {
  it('parses a single path', () => {
    expect(parsePlatformMediaPairs('--platform-media', ['x=banner.png'])).toEqual({
      x: ['banner.png'],
    })
  })

  it('parses comma-separated paths for one platform', () => {
    expect(
      parsePlatformMediaPairs('--platform-media', ['instagram=photo1.jpg,photo2.jpg']),
    ).toEqual({ instagram: ['photo1.jpg', 'photo2.jpg'] })
  })

  it('parses multiple platform entries', () => {
    expect(
      parsePlatformMediaPairs('--platform-media', ['x=banner.png', 'instagram=photo.jpg']),
    ).toEqual({ x: ['banner.png'], instagram: ['photo.jpg'] })
  })

  it('throws on malformed pair', () => {
    expect(() => parsePlatformMediaPairs('--platform-media', ['badformat'])).toThrow(
      /expected.*platform=path/i,
    )
  })

  it('throws on unknown platform', () => {
    expect(() => parsePlatformMediaPairs('--platform-media', ['twitter=x.jpg'])).toThrow(
      /unknown platform/i,
    )
  })
})

// ---------------------------------------------------------------------------
// validateMediaCount
// ---------------------------------------------------------------------------
describe('validateMediaCount', () => {
  it('passes for exactly 10 items', () => {
    expect(() => validateMediaCount(Array(10).fill('f.jpg'))).not.toThrow()
  })

  it('throws for 11 items', () => {
    expect(() => validateMediaCount(Array(11).fill('f.jpg'))).toThrow(/at most 10/i)
  })

  it('passes for 0 items', () => {
    expect(() => validateMediaCount([])).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// validateMediaPaths
// ---------------------------------------------------------------------------
describe('validateMediaPaths', () => {
  it('does not throw when all paths exist', () => {
    // Use a known existing file (this test file itself)
    const thisFile = path.resolve(import.meta.dirname ?? __dirname, 'media-flags.test.ts')
    expect(() => validateMediaPaths([thisFile])).not.toThrow()
  })

  it('throws with the missing path when a file does not exist', () => {
    const missing = path.join(os.tmpdir(), `ap-test-nonexistent-${Date.now()}.jpg`)
    expect(() => validateMediaPaths([missing])).toThrow(/not found/i)
    expect(() => validateMediaPaths([missing])).toThrow(missing)
  })

  it('passes for an empty array', () => {
    expect(() => validateMediaPaths([])).not.toThrow()
  })

  it('creates a real temp file and validates it', () => {
    const tmp = path.join(os.tmpdir(), `ap-test-${Date.now()}.jpg`)
    fs.writeFileSync(tmp, 'data')
    try {
      expect(() => validateMediaPaths([tmp])).not.toThrow()
    } finally {
      fs.unlinkSync(tmp)
    }
  })
})

// ---------------------------------------------------------------------------
// alignAltText
// ---------------------------------------------------------------------------
describe('alignAltText', () => {
  it('aligns alt texts to media by index', () => {
    expect(alignAltText(['a.jpg', 'b.jpg'], ['Alt A', 'Alt B'])).toEqual(['Alt A', 'Alt B'])
  })

  it('fills with undefined when alt texts are fewer than media', () => {
    expect(alignAltText(['a.jpg', 'b.jpg', 'c.jpg'], ['Alt A'])).toEqual([
      'Alt A',
      undefined,
      undefined,
    ])
  })

  it('returns all undefined when no alt texts provided', () => {
    expect(alignAltText(['a.jpg', 'b.jpg'], [])).toEqual([undefined, undefined])
  })

  it('throws when more alt texts than media', () => {
    expect(() => alignAltText(['a.jpg'], ['Alt A', 'Alt B'])).toThrow(/more values/i)
  })
})

// ---------------------------------------------------------------------------
// buildYoutubeOptions
// ---------------------------------------------------------------------------
describe('buildYoutubeOptions', () => {
  it('returns undefined when all opts are empty', () => {
    expect(buildYoutubeOptions({})).toBeUndefined()
  })

  it('maps all fields', () => {
    expect(
      buildYoutubeOptions({
        ytTitle: 'My Video',
        ytDescription: 'Desc',
        ytTags: 'tag1,tag2',
        ytPrivacy: 'private',
        ytCategory: '22',
        ytMadeForKids: false,
      }),
    ).toEqual({
      title: 'My Video',
      description: 'Desc',
      tags: ['tag1', 'tag2'],
      privacyStatus: 'private',
      categoryId: '22',
      madeForKids: false,
    })
  })

  it('includes madeForKids=false when explicitly passed', () => {
    expect(buildYoutubeOptions({ ytMadeForKids: false })?.madeForKids).toBe(false)
  })

  it('trims whitespace from tags', () => {
    expect(buildYoutubeOptions({ ytTags: ' a , b , c ' })?.tags).toEqual(['a', 'b', 'c'])
  })
})

// ---------------------------------------------------------------------------
// buildInstagramOptions
// ---------------------------------------------------------------------------
describe('buildInstagramOptions', () => {
  it('returns undefined when no flags are set', () => {
    expect(buildInstagramOptions({})).toBeUndefined()
  })

  it('returns { reel: {} } when only --ig-reel is set', () => {
    expect(buildInstagramOptions({ igReel: true })).toEqual({ reel: {} })
  })

  it('builds full reel options', () => {
    expect(
      buildInstagramOptions({
        igReel: true,
        igShareToFeed: true,
        igCoverUrl: 'https://example.com/cover.jpg',
        igThumbOffsetMs: '5000',
        igCollaborators: 'user1,user2',
      }),
    ).toEqual({
      reel: {
        shareToFeed: true,
        coverUrl: 'https://example.com/cover.jpg',
        thumbOffsetMs: 5000,
        collaborators: ['user1', 'user2'],
      },
    })
  })

  it('throws on non-numeric --ig-thumb-offset-ms', () => {
    expect(() => buildInstagramOptions({ igThumbOffsetMs: 'notanumber' })).toThrow(
      /non-negative number/i,
    )
  })

  it('throws on negative --ig-thumb-offset-ms', () => {
    expect(() => buildInstagramOptions({ igThumbOffsetMs: '-1' })).toThrow(/non-negative number/i)
  })
})

// ---------------------------------------------------------------------------
// buildThreadsOptions
// ---------------------------------------------------------------------------
describe('buildThreadsOptions', () => {
  it('returns undefined when no flags are set', () => {
    expect(buildThreadsOptions({})).toBeUndefined()
  })

  it('maps replyToId', () => {
    expect(buildThreadsOptions({ threadsReplyTo: 'abc123' })).toEqual({ replyToId: 'abc123' })
  })

  it('maps replyControl', () => {
    expect(buildThreadsOptions({ threadsReplyControl: 'everyone' })).toEqual({
      replyControl: 'everyone',
    })
  })

  it('maps both fields', () => {
    expect(
      buildThreadsOptions({
        threadsReplyTo: 'abc123',
        threadsReplyControl: 'accounts_you_follow',
      }),
    ).toEqual({ replyToId: 'abc123', replyControl: 'accounts_you_follow' })
  })
})
