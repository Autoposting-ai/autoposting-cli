import type { Autoposting } from '@autoposting/sdk'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

type ToolArgs = Record<string, unknown>

function ok(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function parsePlatforms(raw: unknown): string[] {
  if (typeof raw !== 'string') return []
  return raw.split(',').map((p) => p.trim())
}

function parseEvents(raw: unknown): string[] {
  if (typeof raw !== 'string') return []
  return raw.split(',').map((e) => e.trim())
}

export async function handleToolCall(
  name: string,
  args: ToolArgs,
  client: Autoposting,
): Promise<CallToolResult> {
  switch (name) {
    // Posts
    case 'list-posts': {
      const result = await client.posts.list({
        brandSlug: args.brandSlug as string | undefined,
        status: args.status as 'draft' | 'scheduled' | 'published' | 'failed' | undefined,
        limit: args.limit as number | undefined,
        page: args.page as number | undefined,
      })
      return ok(result)
    }
    case 'get-post': {
      const result = await client.posts.getById(args.id as string)
      return ok(result)
    }
    case 'create-post': {
      const result = await client.posts.create({
        brandSlug: args.brandSlug as string,
        text: args.text as string,
        platforms: parsePlatforms(args.platforms) as ReturnType<typeof parsePlatforms>,
        ...(args.scheduledAt ? { scheduledAt: args.scheduledAt as string } : {}),
      })
      return ok(result)
    }
    case 'update-post': {
      const result = await client.posts.update(args.id as string, {
        ...(args.text ? { text: args.text as string } : {}),
        ...(args.platforms
          ? {
              platforms: parsePlatforms(args.platforms) as ReturnType<typeof parsePlatforms>,
            }
          : {}),
        ...(args.scheduledAt ? { scheduledAt: args.scheduledAt as string } : {}),
      })
      return ok(result)
    }
    case 'delete-post': {
      await client.posts.remove(args.id as string)
      return ok({ deleted: true, id: args.id })
    }
    case 'publish-post': {
      const result = await client.posts.publish(args.id as string)
      return ok(result)
    }
    case 'schedule-post': {
      const result = await client.posts.schedule(args.id as string, args.scheduledAt as string)
      return ok(result)
    }
    case 'retry-post': {
      const result = await client.posts.retry(args.id as string)
      return ok(result)
    }
    case 'rewrite-post': {
      const result = await client.posts.rewrite(args.id as string)
      return ok(result)
    }
    case 'score-post': {
      const result = await client.posts.score(args.id as string)
      return ok(result)
    }

    // Brands
    case 'list-brands': {
      const result = await client.brands.list()
      return ok(result)
    }
    case 'get-brand': {
      const result = await client.brands.retrieve(args.brandSlug as string)
      return ok(result)
    }
    case 'create-brand': {
      const result = await client.brands.create({
        name: args.name as string,
        ...(args.timezone ? { timezone: args.timezone as string } : {}),
      })
      return ok(result)
    }
    case 'update-brand': {
      const result = await client.brands.update(args.brandSlug as string, {
        ...(args.name ? { name: args.name as string } : {}),
        ...(args.timezone ? { timezone: args.timezone as string } : {}),
      })
      return ok(result)
    }
    case 'delete-brand': {
      await client.brands.remove(args.brandSlug as string)
      return ok({ deleted: true, brandSlug: args.brandSlug })
    }
    case 'brand-auth-status': {
      const result = await client.brands.authStatus(args.brandSlug as string)
      return ok(result)
    }

    // Agents
    case 'list-agents': {
      const result = await client.agents.list()
      return ok(result)
    }
    case 'get-agent': {
      const result = await client.agents.retrieve(args.id as string)
      return ok(result)
    }
    case 'create-agent': {
      const result = await client.agents.create({
        name: args.name as string,
        type: args.type as 'publish' | 'research',
        prompt: args.prompt as string,
        frequency: args.frequency as 'manual' | 'daily' | 'weekly',
        ...(args.brandSlug ? { brandSlug: args.brandSlug as string } : {}),
        ...(args.time ? { time: args.time as string } : {}),
        ...(args.weekday ? { weekday: args.weekday as string } : {}),
        ...(args.kbId ? { kbId: args.kbId as string } : {}),
      })
      return ok(result)
    }
    case 'update-agent': {
      const result = await client.agents.update(args.id as string, {
        ...(args.name ? { name: args.name as string } : {}),
        ...(args.prompt ? { prompt: args.prompt as string } : {}),
        ...(args.frequency ? { frequency: args.frequency as string } : {}),
        ...(args.time ? { time: args.time as string } : {}),
        ...(args.weekday ? { weekday: args.weekday as string } : {}),
      })
      return ok(result)
    }
    case 'delete-agent': {
      await client.agents.remove(args.id as string)
      return ok({ deleted: true, id: args.id })
    }
    case 'run-agent': {
      const result = await client.agents.run(args.id as string)
      return ok(result)
    }
    case 'toggle-agent': {
      const result = await client.agents.toggle(args.id as string)
      return ok(result)
    }
    case 'agent-runs': {
      const result = await client.agents.runs(args.id as string)
      return ok(result)
    }

    // Knowledge Bases
    case 'list-kbs': {
      const result = await client.kb.list()
      return ok(result)
    }
    case 'get-kb': {
      const result = await client.kb.retrieve(args.id as string)
      return ok(result)
    }
    case 'create-kb': {
      const result = await client.kb.create({ name: args.name as string })
      return ok(result)
    }
    case 'delete-kb': {
      await client.kb.remove(args.id as string)
      return ok({ deleted: true, id: args.id })
    }
    case 'search-kb': {
      const result = await client.kb.search(args.id as string, args.query as string)
      return ok(result)
    }
    case 'ingest-kb': {
      const result = await client.kb.ingestUrl(args.id as string, args.url as string)
      return ok(result)
    }
    case 'kb-docs': {
      const result = await client.kb.docs(args.id as string)
      return ok(result)
    }

    // Ideas
    case 'generate-ideas': {
      const result = await client.ideas.generate({
        ...(args.kbId ? { kbId: args.kbId as string } : {}),
        ...(args.topic ? { topic: args.topic as string } : {}),
        ...(args.count ? { count: args.count as number } : {}),
      })
      return ok(result)
    }
    case 'list-ideas': {
      const result = await client.ideas.list()
      return ok(result)
    }
    case 'enrich-idea': {
      const result = await client.ideas.enrich(args.id as string)
      return ok(result)
    }
    case 'delete-idea': {
      await client.ideas.remove(args.id as string)
      return ok({ deleted: true, id: args.id })
    }

    // Clips
    case 'list-clips': {
      const result = await client.clips.list()
      return ok(result)
    }
    case 'get-clip': {
      const result = await client.clips.retrieve(args.id as string)
      return ok(result)
    }
    case 'import-clip': {
      const result = await client.clips.importUrl({
        url: args.url as string,
        ...(args.name ? { name: args.name as string } : {}),
      })
      return ok(result)
    }
    case 'render-clip': {
      const result = await client.clips.render(args.id as string)
      return ok(result)
    }
    case 'delete-clip': {
      await client.clips.remove(args.id as string)
      return ok({ deleted: true, id: args.id })
    }

    // Carousels
    case 'list-carousels': {
      const result = await client.carousels.list()
      return ok(result)
    }
    case 'get-carousel': {
      const result = await client.carousels.retrieve(args.id as string)
      return ok(result)
    }
    case 'create-carousel': {
      const result = await client.carousels.create(
        args.title ? { title: args.title as string } : undefined,
      )
      return ok(result)
    }
    case 'generate-carousel': {
      const result = await client.carousels.generate({
        topic: args.topic as string,
        ...(args.brandSlug ? { brandSlug: args.brandSlug as string } : {}),
        ...(args.slideCount ? { slideCount: args.slideCount as number } : {}),
      })
      return ok(result)
    }
    case 'draft-carousel': {
      const result = await client.carousels.draft(args.id as string)
      return ok(result)
    }
    case 'delete-carousel': {
      await client.carousels.remove(args.id as string)
      return ok({ deleted: true, id: args.id })
    }

    // Webhooks
    case 'list-webhooks': {
      const result = await client.webhooks.list()
      return ok(result)
    }
    case 'get-webhook': {
      const result = await client.webhooks.retrieve(args.id as string)
      return ok(result)
    }
    case 'create-webhook': {
      const result = await client.webhooks.create({
        url: args.url as string,
        events: parseEvents(args.events),
        ...(args.secret ? { secret: args.secret as string } : {}),
      })
      return ok(result)
    }
    case 'update-webhook': {
      const result = await client.webhooks.update(args.id as string, {
        ...(args.url ? { url: args.url as string } : {}),
        ...(args.events ? { events: parseEvents(args.events) } : {}),
        ...(args.active !== undefined ? { active: args.active as boolean } : {}),
      })
      return ok(result)
    }
    case 'delete-webhook': {
      await client.webhooks.remove(args.id as string)
      return ok({ deleted: true, id: args.id })
    }
    case 'test-webhook': {
      await client.webhooks.test(args.id as string)
      return ok({ sent: true, id: args.id })
    }

    // Billing
    case 'billing-status': {
      const result = await client.billing.status()
      return ok(result)
    }
    case 'billing-credits': {
      const result = await client.billing.credits()
      return ok(result)
    }

    // Usage
    case 'usage-summary': {
      const result = await client.usage.summary()
      return ok(result)
    }

    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      }
  }
}
