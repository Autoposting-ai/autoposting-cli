import { describe, it, expect } from 'vitest'
import { ALL_TOOLS } from '../mcp/tools.js'

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
    const brandTools = ['get-brand', 'update-brand', 'delete-brand', 'brand-auth-status']
    for (const toolName of brandTools) {
      const tool = ALL_TOOLS.find((t) => t.name === toolName)
      expect(tool, `tool "${toolName}" not found`).toBeDefined()
      const props = (tool!.inputSchema as { properties: Record<string, unknown> }).properties
      expect(props, `${toolName} should have brandSlug property`).toHaveProperty('brandSlug')
      expect(props, `${toolName} must not have brandId`).not.toHaveProperty('brandId')
    }
  })

  it('uses text (not content) in create-post and update-post', () => {
    for (const toolName of ['create-post', 'update-post']) {
      const tool = ALL_TOOLS.find((t) => t.name === toolName)
      expect(tool, `tool "${toolName}" not found`).toBeDefined()
      const props = (tool!.inputSchema as { properties: Record<string, unknown> }).properties
      expect(props, `${toolName} should have text property`).toHaveProperty('text')
      expect(props, `${toolName} must not have content property`).not.toHaveProperty('content')
    }
  })

  it('covers all expected resource groups', () => {
    const names = ALL_TOOLS.map((t) => t.name)
    const expectedPrefixes = [
      // posts
      'list-posts', 'get-post', 'create-post', 'update-post', 'delete-post',
      'publish-post', 'schedule-post', 'retry-post', 'rewrite-post', 'score-post',
      // brands
      'list-brands', 'get-brand', 'create-brand', 'update-brand', 'delete-brand',
      'brand-auth-status',
      // agents
      'list-agents', 'get-agent', 'create-agent', 'update-agent', 'delete-agent',
      'run-agent', 'toggle-agent', 'agent-runs',
      // kb
      'list-kbs', 'get-kb', 'create-kb', 'delete-kb', 'search-kb', 'ingest-kb', 'kb-docs',
      // ideas
      'generate-ideas', 'list-ideas', 'enrich-idea', 'delete-idea',
      // clips
      'list-clips', 'get-clip', 'import-clip', 'render-clip', 'delete-clip',
      // carousels
      'list-carousels', 'get-carousel', 'create-carousel', 'generate-carousel',
      'draft-carousel', 'delete-carousel',
      // webhooks
      'list-webhooks', 'get-webhook', 'create-webhook', 'update-webhook',
      'delete-webhook', 'test-webhook',
      // billing + usage
      'billing-status', 'billing-credits', 'usage-summary',
    ]
    for (const expected of expectedPrefixes) {
      expect(names, `missing tool "${expected}"`).toContain(expected)
    }
  })

  it('required fields are correctly set for key tools', () => {
    const cases: Array<{ tool: string; required: string[] }> = [
      { tool: 'create-post', required: ['brandSlug', 'text', 'platforms'] },
      { tool: 'create-agent', required: ['name', 'type', 'prompt', 'frequency'] },
      { tool: 'create-webhook', required: ['url', 'events'] },
      { tool: 'create-kb', required: ['name'] },
      { tool: 'schedule-post', required: ['id', 'scheduledAt'] },
      { tool: 'search-kb', required: ['id', 'query'] },
    ]
    for (const { tool, required } of cases) {
      const found = ALL_TOOLS.find((t) => t.name === tool)
      expect(found, `tool "${tool}" not found`).toBeDefined()
      const schema = found!.inputSchema as { required?: string[] }
      expect(schema.required, `${tool} missing required array`).toBeDefined()
      for (const field of required) {
        expect(schema.required, `${tool} should require "${field}"`).toContain(field)
      }
    }
  })
})
