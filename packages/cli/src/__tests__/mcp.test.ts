import { describe, it, expect } from 'vitest'
import { ALL_TOOLS } from '../mcp/tools.js'
import { handleToolCall } from '../mcp/handler.js'

describe('MCP tool definitions', () => {
  it('has at least 30 tools', () => {
    expect(ALL_TOOLS.length).toBeGreaterThanOrEqual(30)
  })

  it('every tool has name, description, and inputSchema', () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.name, `${tool.name} missing name`).toBeTruthy()
      expect(tool.description, `${tool.name} missing description`).toBeTruthy()
      expect(tool.inputSchema, `${tool.name} missing inputSchema`).toBeDefined()
      expect(tool.inputSchema.type).toBe('object')
    }
  })

  it('all tool names use kebab-case', () => {
    const kebabCase = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
    for (const tool of ALL_TOOLS) {
      expect(tool.name, `"${tool.name}" is not kebab-case`).toMatch(kebabCase)
    }
  })

  it('no duplicate tool names', () => {
    const names = ALL_TOOLS.map((t) => t.name)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })

  it('uses brandSlug (not brandId) in relevant tools', () => {
    const brandTools = [
      'get-brand',
      'update-brand',
      'delete-brand',
      'brand-auth-status',
    ]
    for (const toolName of brandTools) {
      const tool = ALL_TOOLS.find((t) => t.name === toolName)
      expect(tool, `tool "${toolName}" not found`).toBeDefined()
      const props = (
        tool!.inputSchema as { properties: Record<string, unknown> }
      ).properties
      expect(
        props,
        `${toolName} should have brandSlug property`,
      ).toHaveProperty('brandSlug')
      expect(props, `${toolName} must not have brandId`).not.toHaveProperty(
        'brandId',
      )
    }
  })

  it('uses text (not content) in create-post and update-post', () => {
    for (const toolName of ['create-post', 'update-post']) {
      const tool = ALL_TOOLS.find((t) => t.name === toolName)
      expect(tool, `tool "${toolName}" not found`).toBeDefined()
      const props = (
        tool!.inputSchema as { properties: Record<string, unknown> }
      ).properties
      expect(props, `${toolName} should have text property`).toHaveProperty(
        'text',
      )
      expect(
        props,
        `${toolName} must not have content property`,
      ).not.toHaveProperty('content')
    }
  })

  it('covers all expected resource groups', () => {
    const names = ALL_TOOLS.map((t) => t.name)
    const expectedPrefixes = [
      // posts
      'list-posts',
      'get-post',
      'create-post',
      'update-post',
      'delete-post',
      'publish-post',
      'schedule-post',
      'retry-post',
      'rewrite-post',
      'score-post',
      // brands
      'list-brands',
      'get-brand',
      'create-brand',
      'update-brand',
      'delete-brand',
      'brand-auth-status',
      // agents
      'list-agents',
      'get-agent',
      'create-agent',
      'update-agent',
      'delete-agent',
      'run-agent',
      'toggle-agent',
      'agent-runs',
      // kb
      'list-kbs',
      'get-kb',
      'create-kb',
      'delete-kb',
      'search-kb',
      'ingest-kb',
      'kb-docs',
      // ideas
      'generate-ideas',
      'list-ideas',
      'enrich-idea',
      'delete-idea',
      // clips
      'list-clips',
      'get-clip',
      'import-clip',
      'render-clip',
      'create-clip-draft',
      'delete-clip',
      // carousels
      'list-carousels',
      'get-carousel',
      'create-carousel',
      'generate-carousel',
      'draft-carousel',
      'delete-carousel',
      // webhooks
      'list-webhooks',
      'get-webhook',
      'create-webhook',
      'update-webhook',
      'delete-webhook',
      'test-webhook',
      // billing + usage
      'billing-status',
      'billing-credits',
      'usage-summary',
    ]
    for (const expected of expectedPrefixes) {
      expect(names, `missing tool "${expected}"`).toContain(expected)
    }
  })

  it('required fields are correctly set for key tools', () => {
    const cases: Array<{ tool: string; required: string[] }> = [
      { tool: 'create-post', required: ['brandSlug', 'text', 'platforms'] },
      {
        tool: 'create-agent',
        required: ['name', 'type', 'prompt', 'frequency'],
      },
      { tool: 'create-webhook', required: ['url', 'events'] },
      { tool: 'create-kb', required: ['name', 'description'] },
      { tool: 'schedule-post', required: ['id', 'scheduledAt'] },
      { tool: 'search-kb', required: ['id', 'query'] },
    ]
    for (const { tool, required } of cases) {
      const found = ALL_TOOLS.find((t) => t.name === tool)
      expect(found, `tool "${tool}" not found`).toBeDefined()
      const schema = found!.inputSchema as { required?: string[] }
      expect(schema.required, `${tool} missing required array`).toBeDefined()
      for (const field of required) {
        expect(schema.required, `${tool} should require "${field}"`).toContain(
          field,
        )
      }
    }
  })
})

describe('MCP tool handler', () => {
  it('passes the required knowledge-base description to the SDK', async () => {
    let captured: unknown
    const args = { name: 'Product Docs', description: 'Verified product reference material.' }
    const client = { kb: { create: async (params: unknown) => { captured = params; return { id: 'kb-1' } } } }
    const result = await handleToolCall('create-kb', args, client as never)
    expect(result.isError).not.toBe(true)
    expect(captured).toEqual(args)
  })
  it('parses comma-separated post platforms into SDK platform arrays', async () => {
    let captured: unknown
    const client = {
      posts: {
        create: async (params: unknown) => {
          captured = params
          return { id: 'post-1' }
        },
      },
    }

    const result = await handleToolCall(
      'create-post',
      { brandSlug: 'brand', text: 'hello', platforms: 'x, linkedin' },
      client as never,
    )

    expect(result.isError).not.toBe(true)
    expect(captured).toEqual({
      brandSlug: 'brand',
      text: 'hello',
      platforms: ['x', 'linkedin'],
    })
  })

  it('returns MCP error content instead of calling SDK for invalid post platforms', async () => {
    let called = false
    const client = {
      posts: {
        create: async () => {
          called = true
          return { id: 'post-1' }
        },
      },
    }

    const result = await handleToolCall(
      'create-post',
      { brandSlug: 'brand', text: 'hello', platforms: 'x, mastodon' },
      client as never,
    )

    expect(called).toBe(false)
    expect(result.isError).toBe(true)
    const content = result.content[0]
    expect(content?.type).toBe('text')
    if (content?.type !== 'text') throw new Error('Expected text error content')
    expect(content.text).toMatch(/Invalid platform/)
  })

  it('forwards media on create-post and update-post', async () => {
    const calls: unknown[] = []
    const client = {
      posts: {
        create: async (params: unknown) => { calls.push(params); return { id: 'p1' } },
        update: async (id: string, params: unknown) => { calls.push({ id, ...(params as object) }); return { id } },
      },
    }
    const media = [{ url: 'https://cdn.example.com/a.jpg', type: 'image' }]

    await handleToolCall('create-post', { brandSlug: 'b', text: 't', platforms: 'x', media }, client as never)
    await handleToolCall('update-post', { id: 'p1', media }, client as never)

    expect(calls).toEqual([
      { brandSlug: 'b', text: 't', platforms: ['x'], media },
      { id: 'p1', media },
    ])
  })

  it('runs the AI clipping chain with brandId, editRevision and draft creation', async () => {
    const calls: unknown[] = []
    const client = {
      clips: {
        importUrl: async (p: unknown) => { calls.push(['import', p]); return { clipId: 'c1' } },
        render: async (id: string, p: unknown) => { calls.push(['render', id, p]); return { jobIds: [] } },
        createDraft: async (id: string, p: unknown) => { calls.push(['draft', id, p]); return { postId: 'p1' } },
      },
    }

    await handleToolCall('import-clip', { url: 'https://youtu.be/x', brandId: 'b1', name: 'n' }, client as never)
    await handleToolCall('render-clip', { id: 'c1', editRevision: 2, candidateId: 'k1' }, client as never)
    await handleToolCall('create-clip-draft', { id: 'c1', aspectRatio: '9:16' }, client as never)

    expect(calls).toEqual([
      ['import', { url: 'https://youtu.be/x', brandId: 'b1', title: 'n' }],
      ['render', 'c1', { editRevision: 2, candidateId: 'k1' }],
      ['draft', 'c1', { aspectRatio: '9:16' }],
    ])
  })
})

describe('Facebook local MCP retry', () => {
  it('forwards explicit Facebook selection and retains safe recovery results', async () => {
    expect(ALL_TOOLS.find(tool => tool.name === 'retry-post')?.inputSchema.properties?.platform).toMatchObject({ type: 'string' })
    const calls: unknown[] = []
    const accepted = { id: 'post', status: 'publishing', retrying: ['facebook'], pageIds: ['failed-page'] }
    const client = { posts: { retry: async (...args: unknown[]) => { calls.push(args); return accepted } } }
    const result = await handleToolCall('retry-post', { id: 'post', platform: 'facebook' }, client as never)
    expect(calls).toEqual([['post', 'facebook']])
    expect(result.content[0]).toMatchObject({ type: 'text', text: JSON.stringify(accepted, null, 2) })
  })
})

describe('Facebook local MCP authoring', () => {
  it.each([
    { facebookOptions: null },
    { facebookOptions: { format: 'story' } },
    { facebookOptions: { format: 'link', link: 42 } },
    { targetAccountIds: { facebook: [] } },
    { targetAccountIds: { facebook: ['page', 'page'] } },
    { platformTexts: { facebook: null } },
    { platformMedia: { facebook: [{}] } },
  ])('rejects malformed authoring intent before dispatch: %j', async (intent) => {
    const calls: unknown[] = []
    const client = { posts: { create: async (body: unknown) => { calls.push(body); return {} },
      update: async (_id: string, body: unknown) => { calls.push(body); return {} } } }
    for (const tool of ['create-post', 'update-post']) {
      const result = await handleToolCall(tool, { id: 'post', brandSlug: 'brand', text: 'Caption', platforms: ['facebook'], ...intent }, client as never)
      expect(result.isError).toBe(true)
    }
    expect(calls).toEqual([])
  })
  it.each(['create-post', 'update-post'])('advertises and forwards nested intent through %s', async (tool) => {
    const properties = ALL_TOOLS.find(item => item.name === tool)?.inputSchema.properties as Record<string, any>
    expect(properties.facebookOptions.properties.format.enum).toEqual(['text', 'link', 'photo', 'multi-photo', 'video', 'reel'])
    expect(properties.targetAccountIds.properties.facebook.items.type).toBe('string')
    const intent = { facebookOptions: { format: 'link', link: 'https://example.com/article' }, targetAccountIds: { facebook: ['page'] },
      platformTexts: { facebook: '' }, platformMedia: { facebook: [] } }
    const calls: unknown[] = []
    const client = { posts: { create: async (body: unknown) => { calls.push(body); return { id: 'post' } },
      update: async (_id: string, body: unknown) => { calls.push(body); return { id: 'post' } } } }
    await handleToolCall(tool, { id: 'post', brandSlug: 'brand', text: 'Caption', platforms: ['facebook'], ...intent }, client as never)
    expect(calls[0]).toMatchObject({ ...intent, platforms: ['facebook'] })
  })
})


it('forwards future Facebook recovery and rejects unsupported scheduling platforms', async () => {
  const calls: unknown[] = []
  const client = { posts: { schedule: async (...args: unknown[]) => { calls.push(args); return { id: 'post', pageIds: ['page'] } } } }
  const result = await handleToolCall('schedule-post', { id: 'post', scheduledAt: '2027-01-01T10:00:00Z', platform: 'facebook' }, client as never)
  expect(result.isError).not.toBe(true)
  expect(calls).toEqual([['post', '2027-01-01T10:00:00Z', 'facebook']])
  const invalid = await handleToolCall('schedule-post', { id: 'post', scheduledAt: '2027-01-01T10:00:00Z', platform: 'x' }, client as never)
  expect(invalid.isError).toBe(true)
  expect(calls).toHaveLength(1)
})

it('preserves an intentionally empty main caption when updating a Facebook photo', async () => {
  const calls: unknown[] = []
  const client = { posts: { update: async (_id: string, body: unknown) => {
    calls.push(body)
    return { id: 'post' }
  } } }
  const result = await handleToolCall('update-post', {
    id: 'post', text: '', platforms: ['facebook'],
    facebookOptions: { format: 'photo' }, targetAccountIds: { facebook: ['page'] },
  }, client as never)
  expect(result.isError).not.toBe(true)
  expect(calls).toEqual([{
    text: '', platforms: ['facebook'],
    facebookOptions: { format: 'photo' }, targetAccountIds: { facebook: ['page'] },
  }])
})


describe('MCP schedule cancellation', () => {
  it('advertises cancellation and preserves the restored Facebook outcome', async () => {
    expect(ALL_TOOLS.find(tool => tool.name === 'cancel-schedule')?.inputSchema).toMatchObject({
      required: ['id'], additionalProperties: false,
    })
    const restored = { id: 'post', status: 'partial', platformResults: { facebook: { accounts: [
      { accountId: 'published-page', status: 'published', platformPostId: 'remote-post' },
      { accountId: 'unknown-page', status: 'unknown' },
    ] } } }
    const calls: string[] = []
    const client = { posts: { unschedule: async (id: string) => { calls.push(id); return restored } } }
    const result = await handleToolCall('cancel-schedule', { id: 'post' }, client as never)
    expect(result.isError).not.toBe(true)
    expect(JSON.parse(result.content[0]!.text)).toEqual(restored)
    expect(calls).toEqual(['post'])
  })

  it('rejects invalid IDs and scheduling fields without cancelling anything', async () => {
    let calls = 0
    const client = { posts: { unschedule: async () => { calls++; return {} } } }
    for (const args of [{}, { id: null }, { id: 1 }, { id: '' }, { id: '  ' },
      { id: 'post', scheduledAt: '2027-01-01T10:00:00Z' }, { id: 'post', platform: 'facebook' }]) {
      expect((await handleToolCall('cancel-schedule', args, client as never)).isError).toBe(true)
    }
    expect(calls).toBe(0)
  })

  it('returns a cancellation failure instead of claiming success', async () => {
    const client = { posts: { unschedule: async () => { throw new Error('Post is already publishing') } } }
    const result = await handleToolCall('cancel-schedule', { id: 'post' }, client as never)
    expect(result.isError).toBe(true)
    expect(result.content[0]!.text).toBe('Post is already publishing')
  })
})
