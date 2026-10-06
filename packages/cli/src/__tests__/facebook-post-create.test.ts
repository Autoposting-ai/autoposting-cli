import { describe, it, expect, vi } from 'vitest'
import { createPostsBulk } from '../lib/post-bulk.js'
import { buildAndCreatePost } from '../lib/post-create.js'
import type { Autoposting } from '@autoposting.ai/sdk'

describe('Facebook CLI post creation', () => {
  it.each([{ facebookFormat: undefined }, { facebookFormat: 'story' }, { facebookFormat: 'photo' },
    { facebookFormat: 'video' }, { facebookFormat: 'reel' }, { facebookFormat: 'link', facebookLink: 'http://example.com' }])
    ('rejects invalid format intent before network calls: %j', async (options) => {
      const authStatus = vi.fn(), upload = vi.fn(), create = vi.fn()
      const client = { brands: { authStatus }, media: { upload }, posts: { create } } as unknown as Autoposting
      await expect(buildAndCreatePost(client, { brandSlug: 'brand', text: 'Caption', platforms: 'facebook', ...options },
        { isTty: false, dryRun: true })).rejects.toThrow()
      expect(authStatus).not.toHaveBeenCalled()
      expect(upload).not.toHaveBeenCalled()
      expect(create).not.toHaveBeenCalled()
    })

  it('resolves a link draft in dry-run without upload or create calls', async () => {
    const upload = vi.fn(), create = vi.fn()
    const client = { brands: { authStatus: async () => [{ platform: 'facebook', connected: true, platformUserId: 'page' }] },
      media: { upload }, posts: { create } } as unknown as Autoposting
    expect(await buildAndCreatePost(client, { brandSlug: 'brand', text: 'Caption', platforms: 'facebook',
      facebookFormat: 'link', facebookLink: 'https://example.com/article', account: ['facebook=page'] }, { isTty: false, dryRun: true }))
      .toMatchObject({ dryRun: true, request: { facebookOptions: { format: 'link', link: 'https://example.com/article' }, targetAccountIds: { facebook: ['page'] } } })
    expect(upload).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })
})

describe('Facebook bulk JSON contract', () => {
  it.each([{ media: [] }, { media: [{ url: 'https://example.com/photo.png', type: 'image' }] }])('preserves canonical media overrides without uploading: %j', async ({ media }) => {
    const create = vi.fn().mockResolvedValue({ id: 'created' }), upload = vi.fn()
    const client = { brands: { authStatus: async () => [{ platform: 'facebook', connected: true, platformUserId: 'page' }] }, media: { upload }, posts: { create } } as unknown as Autoposting
    const results = await createPostsBulk(client, [{ brandSlug: 'brand', text: 'Caption', platforms: ['facebook'],
      facebookOptions: { format: media.length ? 'photo' : 'text' }, targetAccountIds: { facebook: ['page'] }, platformMedia: { facebook: media } }])
    expect(results[0]).toMatchObject({ status: 'created' })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ platformMedia: { facebook: media } }))
    expect(upload).not.toHaveBeenCalled()
  })
  it('maps nested format and Page IDs without uploading link drafts', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'created' }), upload = vi.fn()
    const client = { brands: { authStatus: async () => [{ platform: 'facebook', connected: true, platformUserId: 'page' }] },
      media: { upload }, posts: { create } } as unknown as Autoposting
    const results = await createPostsBulk(client, [{ brandSlug: 'brand', text: 'Caption', platforms: ['facebook'],
      facebookOptions: { format: 'link', link: 'https://example.com/article' }, targetAccountIds: { facebook: ['page'] }, platformTexts: { facebook: '', x: 'Other caption' } }])
    expect(results[0]).toMatchObject({ status: 'created', id: 'created' })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ facebookOptions: { format: 'link', link: 'https://example.com/article' },
      targetAccountIds: { facebook: ['page'] }, platformTexts: { facebook: '', x: 'Other caption' } }))
    expect(upload).not.toHaveBeenCalled()
  })
})


describe('Canonical shared media', () => {
  it.each([false, true])('preserves shared URL media and explicit Facebook override (override=%s)', async (override) => {
    const media = [{ url: 'https://example.com/photo.png', type: 'image', altText: 'Chart' }]
    const create = vi.fn().mockResolvedValue({ id: 'created' }), upload = vi.fn()
    const client = { brands: { authStatus: async () => [{ platform: 'facebook', connected: true, platformUserId: 'page' }] }, media: { upload }, posts: { create } } as unknown as Autoposting
    const results = await createPostsBulk(client, [{ brandSlug: 'brand', text: 'Caption', platforms: ['facebook'], media,
      facebookOptions: { format: override ? 'text' : 'photo' }, targetAccountIds: { facebook: ['page'] },
      ...(override ? { platformMedia: { facebook: [] } } : {}) }])
    expect(results[0]).toMatchObject({ status: 'created' })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ media, ...(override ? { platformMedia: { facebook: [] } } : {}) }))
    expect(upload).not.toHaveBeenCalled()
  })
})


describe('Shared media validation before account lookup', () => {
  it.each([
    [{ url: 'http://example.com/a.png', type: 'image' }],
    [{ url: 'https://user:pass@example.com/a.png', type: 'image' }],
    [{ url: 'https://example.com/a.png', type: 'audio' }],
    [{ url: 'https://example.com/a.png', type: 'image', altText: 42 }],
    ['photo.png', { url: 'https://example.com/a.png', type: 'image' }],
  ])('rejects malformed or mixed canonical media: %j', async (...items) => {
    const authStatus = vi.fn(), upload = vi.fn(), create = vi.fn()
    const client = { brands: { authStatus }, media: { upload }, posts: { create } } as unknown as Autoposting
    const results = await createPostsBulk(client, [{ brandSlug: 'brand', text: 'Caption', platforms: ['facebook'], media: items,
      facebookOptions: { format: 'photo' }, targetAccountIds: { facebook: ['page'] } }])
    expect(results[0]).toMatchObject({ status: 'failed' })
    expect(authStatus).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })
})


it('preserves an empty photo caption and canonical future schedule in bulk JSON', async () => {
  const create = vi.fn().mockResolvedValue({id:'created'}), upload = vi.fn()
  const client = {brands:{authStatus:async()=>[{platform:'facebook',connected:true,platformUserId:'page'}]},media:{upload},posts:{create}} as unknown as Autoposting
  const scheduledAt = new Date(Date.now()+3600000).toISOString()
  const results = await createPostsBulk(client,[{brandSlug:'brand',text:'',platforms:['facebook'],scheduledAt,
    media:[{url:'https://example.com/photo.png',type:'image'}],facebookOptions:{format:'photo'},targetAccountIds:{facebook:['page']}}])
  expect(results[0]).toMatchObject({status:'created'})
  expect(create).toHaveBeenCalledWith(expect.objectContaining({text:'',scheduledAt}))
  expect(upload).not.toHaveBeenCalled()
})
