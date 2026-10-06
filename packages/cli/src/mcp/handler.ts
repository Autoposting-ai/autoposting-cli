import type { Autoposting } from '@autoposting.ai/sdk'
import type { CreateClipDraftParams, MediaInput, Platform, CreatePostParams } from '@autoposting.ai/sdk'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { assertApiRoute, fetchApiRoutes } from '../lib/api-routes.js'
import { extToMime } from '../lib/media-flags.js'

type ToolArgs = Record<string, unknown>
const PLATFORMS: Platform[] = [
  'x',
  'linkedin',
  'instagram',
  'threads',
  'youtube',
  'facebook',
]
const PLATFORM_SET = new Set<string>(PLATFORMS)

function validateAuthoringIntent(args: ToolArgs): void {
  const object = (value: unknown, field: string): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object.`)
    return value as Record<string, unknown>
  }
  if (args.facebookOptions !== undefined) {
    const options = object(args.facebookOptions, 'facebookOptions')
    if (!['text', 'link', 'photo', 'multi-photo', 'video', 'reel'].includes(options.format as string)) {
      throw new Error('facebookOptions.format must be a supported Facebook format.')
    }
    if (options.link !== undefined && typeof options.link !== 'string') throw new Error('facebookOptions.link must be a string.')
    if (Object.keys(options).some(key => !['format', 'link'].includes(key))) throw new Error('Unknown facebookOptions field.')
  }
  for (const field of ['targetAccountIds', 'platformTexts', 'platformMedia'] as const) {
    if (args[field] === undefined) continue
    for (const [platform, value] of Object.entries(object(args[field], field))) {
      if (!PLATFORM_SET.has(platform)) throw new Error(`Invalid platform in ${field}.`)
      if (field === 'platformTexts') {
        if (typeof value !== 'string') throw new Error('Platform captions must be strings.')
      } else if (field === 'targetAccountIds') {
        if (!Array.isArray(value) || value.length === 0 || value.some(id => typeof id !== 'string' || !id.trim()) || new Set(value).size !== value.length) {
          throw new Error('Target account IDs must be a nonempty array of unique IDs.')
        }
      } else {
        if (!Array.isArray(value)) throw new Error('Platform media must be an array.')
        for (const item of value) {
          const media = object(item, 'Media item')
          if (typeof media.url !== 'string' || !media.url.trim() || !['image', 'video', 'gif'].includes(media.type as string)) {
            throw new Error('Media items require a URL and image, video or gif type.')
          }
          if (media.altText !== undefined && typeof media.altText !== 'string') throw new Error('Media altText must be a string.')
        }
      }
    }
  }
}

function ok(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function fail(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error)
  return { content: [{ type: 'text', text: message }], isError: true }
}

function parsePlatforms(raw: unknown): Platform[] {
  if (raw === undefined) return []
  if (typeof raw !== 'string' && !Array.isArray(raw)) {
    throw new Error('Platforms must be a comma-separated string or an array of platform names.')
  }
  const values = typeof raw === 'string' ? raw.split(',') : raw
  if (values.some((value) => typeof value !== 'string')) {
    throw new Error('Every platform must be a platform name.')
  }
  const platforms = (values as string[])
    .map((p) => p.trim())
    .filter(Boolean)
  const invalid = platforms.filter((platform) => !PLATFORM_SET.has(platform))
  if (invalid.length > 0) {
    throw new Error(
      `Invalid platform(s): ${invalid.join(', ')}. Expected one of: ${PLATFORMS.join(', ')}.`,
    )
  }
  return platforms as Platform[]
}

// One allow-list fetch per server process; a failed fetch is not cached, so the next call retries.
const routeCache = new WeakMap<object, Promise<string[]>>()
function apiRoutes(client: Autoposting): Promise<string[]> {
  let routes = routeCache.get(client)
  if (!routes) {
    routes = fetchApiRoutes(client)
    routeCache.set(client, routes)
    routes.catch(() => routeCache.delete(client))
  }
  return routes
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
  try {
    return await dispatchToolCall(name, args, client)
  } catch (error) {
    return fail(error)
  }
}

async function dispatchToolCall(
  name: string,
  args: ToolArgs,
  client: Autoposting,
): Promise<CallToolResult> {
  if (name === 'create-post' || name === 'update-post') validateAuthoringIntent(args)
  switch (name) {
    case 'delete-account-import': return ok(await client.accountOnboarding.remove(args.id as string))
    case 'import-accounts': return ok(await client.accountOnboarding.create({ csv: args.csv as string }))
    case 'prepare-account-import': return ok(await client.accountOnboarding.prepare(args.id as string, args.offset as number | undefined))
    case 'account-import-status': return ok(await client.accountOnboarding.status(args.id as string, { ...(args.offset !== undefined ? {offset:args.offset as number}:{}), ...(args.limit !== undefined ? {limit:args.limit as number}:{}) }))
    case 'authorize-import-account': return ok(await client.accountOnboarding.authorize(args.id as string, args.rowId as string))
    case 'confirm-import-account': return ok(await client.accountOnboarding.confirm(args.id as string, args.rowId as string, args.tokenId as string))
    // Posts
    case 'list-posts': {
      const result = await client.posts.list({
        brandSlug: args.brandSlug as string | undefined,
        status: args.status as
          | 'draft'
          | 'scheduled'
          | 'published'
          | 'failed'
          | undefined,
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
        platforms: parsePlatforms(args.platforms),
        ...(args.scheduledAt
          ? { scheduledAt: args.scheduledAt as string }
          : {}),
        ...(args.media ? { media: args.media as MediaInput[] } : {}),
        ...(args.facebookOptions !== undefined ? { facebookOptions: args.facebookOptions as CreatePostParams['facebookOptions'] } : {}),
        ...(args.targetAccountIds !== undefined ? { targetAccountIds: args.targetAccountIds as CreatePostParams['targetAccountIds'] } : {}),
        ...(args.platformTexts !== undefined ? { platformTexts: args.platformTexts as CreatePostParams['platformTexts'] } : {}),
        ...(args.platformMedia !== undefined ? { platformMedia: args.platformMedia as CreatePostParams['platformMedia'] } : {}),
      })
      return ok(result)
    }
    case 'update-post': {
      const result = await client.posts.update(args.id as string, {
        ...(args.text ? { text: args.text as string } : {}),
        ...(args.platforms
          ? {
              platforms: parsePlatforms(args.platforms),
            }
          : {}),
        ...(args.scheduledAt
          ? { scheduledAt: args.scheduledAt as string }
          : {}),
        ...(args.media ? { media: args.media as MediaInput[] } : {}),
        ...(args.facebookOptions !== undefined ? { facebookOptions: args.facebookOptions as CreatePostParams['facebookOptions'] } : {}),
        ...(args.targetAccountIds !== undefined ? { targetAccountIds: args.targetAccountIds as CreatePostParams['targetAccountIds'] } : {}),
        ...(args.platformTexts !== undefined ? { platformTexts: args.platformTexts as CreatePostParams['platformTexts'] } : {}),
        ...(args.platformMedia !== undefined ? { platformMedia: args.platformMedia as CreatePostParams['platformMedia'] } : {}),
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
      if (args.platform !== undefined && args.platform !== 'facebook') throw new Error('Scheduled recovery requires platform facebook')
      const result = args.platform === 'facebook'
        ? await client.posts.schedule(args.id as string, args.scheduledAt as string, 'facebook')
        : await client.posts.schedule(args.id as string, args.scheduledAt as string)
      return ok(result)
    }
    case 'retry-post': {
      const platforms = args.platform === undefined ? undefined : parsePlatforms(args.platform)
      if (platforms && platforms.length !== 1) throw new Error('Retry requires exactly one platform')
      const result = platforms ? await client.posts.retry(args.id as string, platforms[0]!) : await client.posts.retry(args.id as string)
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
      const result = await client.kb.create({ name: args.name as string, description: args.description as string })
      return ok(result)
    }
    case 'delete-kb': {
      await client.kb.remove(args.id as string)
      return ok({ deleted: true, id: args.id })
    }
    case 'search-kb': {
      const result = await client.kb.search(
        args.id as string,
        args.query as string,
      )
      return ok(result)
    }
    case 'ingest-kb': {
      const result = await client.kb.ingestUrl(
        args.id as string,
        args.url as string,
      )
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
      const result = await client.ideas.enrich({
        idea: {
          title: args.title as string,
          hook: args.hook as string,
          angle: args.angle as string,
        },
        platforms: (args.platforms as string[]).map((platform) => ({
          platform: platform as 'twitter' | 'linkedin' | 'instagram' | 'youtube' | 'threads',
        })),
        ...(args.kbId ? { kbId: args.kbId as string } : {}),
      })
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
        brandId: args.brandId as string,
        ...(args.name ? { title: args.name as string } : {}),
      })
      return ok(result)
    }
    case 'render-clip': {
      const result = await client.clips.render(args.id as string, {
        editRevision: args.editRevision as number,
        ...(args.candidateId ? { candidateId: args.candidateId as string } : {}),
      })
      return ok(result)
    }
    case 'create-clip-draft': {
      const result = await client.clips.createDraft(args.id as string, {
        ...(args.candidateId ? { candidateId: args.candidateId as string } : {}),
        ...(args.aspectRatio ? { aspectRatio: args.aspectRatio as CreateClipDraftParams['aspectRatio'] } : {}),
      })
      return ok(result)
    }
    case 'upload-clip': {
      const result = await client.clips.upload(args.filePath as string, {
        brandId: args.brandId as string,
        ...(args.title ? { title: args.title as string } : {}),
      })
      return ok(result)
    }
    case 'publish-clip': {
      const body: Record<string, unknown> = { mode: args.mode }
      for (const k of ['candidateId', 'text', 'brandSlug', 'scheduledAt', 'aspectRatio']) {
        if (args[k] !== undefined) body[k] = args[k]
      }
      if (args.platforms !== undefined) body.platforms = parsePlatforms(args.platforms)
      return ok(await client.request('POST', `/clips/${encodeURIComponent(args.id as string)}/publish`, body))
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
        ...(args.active !== undefined
          ? { active: args.active as boolean }
          : {}),
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

    // Media
    case 'upload-media': {
      const filePath = args.filePath as string
      const filename = basename(filePath)
      const uploaded = await client.media.upload({
        data: new Uint8Array(await readFile(filePath)),
        filename,
        contentType: extToMime(filename),
      })
      return ok({ url: uploaded.url, type: uploaded.type, ...(args.altText ? { altText: args.altText } : {}) })
    }

    // Any other REST route on the server's allow-list
    case 'list-api-routes': {
      const prefix = typeof args.prefix === 'string' ? args.prefix : '/'
      const routes = await apiRoutes(client)
      return ok({ routes: routes.filter((r) => r.split(' ')[1].startsWith(prefix)) })
    }
    case 'api-request': {
      const method = String(args.method ?? '').toUpperCase()
      const path = String(args.path ?? '')
      assertApiRoute(await apiRoutes(client), method, path)
      const query = typeof args.query === 'object' && args.query ? (args.query as Record<string, unknown>) : undefined
      const body = method !== 'GET' && method !== 'DELETE' && typeof args.body === 'object' && args.body ? args.body : undefined
      return ok(await client.request(method as never, path, body, query))
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
