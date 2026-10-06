import fs from 'node:fs/promises'
import nodePath from 'node:path'
import type { Autoposting, MediaInput, Platform, FacebookOptions } from '@autoposting.ai/sdk'
import {
  extToMime,
  parsePairs,
  parsePlatformMediaPairs,
  validateMediaCount,
  validateMediaPaths,
  validateMediaExtensions,
  alignAltText,
  buildYoutubeOptions,
  buildInstagramOptions,
  buildThreadsOptions,
} from './media-flags.js'
import { resolveTargetAccounts } from './account-select.js'

const VALID_PLATFORMS: readonly Platform[] = ['x', 'linkedin', 'instagram', 'threads', 'youtube', 'facebook']

export function parsePlatforms(raw: string): Platform[] {
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) {
    throw new Error('No platforms provided. Pass a comma-separated list, e.g. --platforms x,linkedin')
  }
  const invalid = parts.filter((p) => !VALID_PLATFORMS.includes(p as Platform))
  if (invalid.length > 0) {
    throw new Error(
      `Unsupported platform(s): ${invalid.join(', ')}. Valid platforms: ${VALID_PLATFORMS.join(', ')}`,
    )
  }
  return parts as Platform[]
}

export function validateScheduledAt(value: string): string {
  // Require a real ISO 8601 datetime. Date.parse alone is lenient (accepts locale formats
  // like "01/02/2026"), so also require the YYYY-MM-DDTHH:MM prefix the API expects.
  const ms = Date.parse(value)
  if (Number.isNaN(ms) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    throw new Error(
      `--at must be a valid ISO 8601 datetime, e.g. 2026-06-30T14:00:00Z (received "${value}").`,
    )
  }
  // A past time means the post would publish immediately on submit — almost never intended,
  // and irreversible for an instant publish. Reject it here, before any create/schedule call.
  if (ms <= Date.now()) {
    throw new Error(
      `--at must be in the future (received "${value}", which is in the past). ` +
        `A past schedule time publishes immediately.`,
    )
  }
  return value
}

function validateCanonicalMedia(items: MediaInput[]): void {
  for (const item of items) {
    if (!item || typeof item !== 'object' || typeof item.url !== 'string' || !['image', 'video', 'gif'].includes(item.type)) throw new Error('Media items require a URL and supported type')
    let url: URL
    try { url = new URL(item.url) } catch { throw new Error('Media URL must use HTTPS') }
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Media URL must use credential-free HTTPS')
    if (item.altText !== undefined && typeof item.altText !== 'string') throw new Error('Media altText must be a string')
  }
}

/** One post's inputs — same field names as `posts create` opts, brand already resolved. */
export interface PostFields {
  brandSlug: string
  text: string
  platforms: string
  at?: string
  thread?: string[]
  media?: string[] | MediaInput[]
  altText?: string[]
  platformText?: string[]
  platformMedia?: string[] | Partial<Record<Platform, MediaInput[]>>
  ytTitle?: string
  ytDescription?: string
  ytTags?: string
  ytPrivacy?: string
  ytCategory?: string
  ytMadeForKids?: boolean
  igReel?: boolean
  igShareToFeed?: boolean
  igCoverUrl?: string
  igThumbOffsetMs?: string
  igCollaborators?: string
  threadsReplyTo?: string
  threadsReplyControl?: string
  facebookFormat?: string
  facebookLink?: string
  account?: string[]
}

export interface BuildOptions {
  isTty: boolean
  /** When true: validate + resolve accounts, then return the request body — no upload, no POST. */
  dryRun?: boolean
  /** Human-facing hints sink (fan-out count); defaults to stderr inside resolveTargetAccounts. */
  emit?: (message: string) => void
  /** Called after account resolution, before any upload/POST — used to start the spinner (M3). */
  onBeforeNetwork?: () => void
}

/**
 * Validates one post's inputs, resolves target accounts, then either creates it
 * (uploading media first) or — in dry-run — returns the resolved request body with
 * media left as local paths. Shared by `posts create` (single) and `--from` (bulk).
 */
export async function buildAndCreatePost(
  client: Autoposting,
  fields: PostFields,
  opts: BuildOptions,
): Promise<unknown> {
  // ── Pure validation pass (synchronous/disk-only) — runs before any network call ──
  const platforms = parsePlatforms(fields.platforms)
  const scheduledAt = fields.at ? validateScheduledAt(fields.at) : undefined

  const sharedMedia = fields.media ?? []
  if (!Array.isArray(sharedMedia)) throw new Error('media must be an array')
  const localMedia = sharedMedia.every(item => typeof item === 'string') ? sharedMedia as string[] : []
  const sharedCanonicalMedia = localMedia.length || !sharedMedia.length ? [] : sharedMedia as MediaInput[]
  validateCanonicalMedia(sharedCanonicalMedia)
  if (localMedia.length) {
    validateMediaCount(localMedia)
    validateMediaPaths(localMedia)
    validateMediaExtensions(localMedia)
  }

  const platformTexts =
    fields.platformText && fields.platformText.length > 0
      ? parsePairs('--platform-text', fields.platformText)
      : undefined

  const suppliedMedia = fields.platformMedia
  const canonicalMedia: Partial<Record<Platform, MediaInput[]>> = {}
  if (suppliedMedia !== undefined && !Array.isArray(suppliedMedia)) {
    if (!suppliedMedia || typeof suppliedMedia !== 'object') throw new Error('platformMedia must be an object or local path flags')
    for (const [platform, items] of Object.entries(suppliedMedia)) {
      if (!VALID_PLATFORMS.includes(platform as Platform) || !Array.isArray(items)) throw new Error('platformMedia requires supported platforms and media arrays')
      validateCanonicalMedia(items)
      canonicalMedia[platform as Platform] = items
    }
  }
  const platformMediaPaths =
    Array.isArray(suppliedMedia) && suppliedMedia.length > 0
      ? parsePlatformMediaPairs('--platform-media', suppliedMedia)
      : {}
  for (const paths of Object.values(platformMediaPaths)) {
    validateMediaPaths(paths)
    validateMediaExtensions(paths)
  }

  let facebookOptions: FacebookOptions | undefined
  if (platforms.includes('facebook')) {
    const format = fields.facebookFormat
    if (!format || !['text', 'link', 'photo', 'multi-photo', 'video', 'reel'].includes(format)) {
      throw new Error('--facebook-format must be text, link, photo, multi-photo, video or reel')
    }
    const paths = canonicalMedia.facebook ?? platformMediaPaths.facebook ?? fields.media ?? []
    const images = paths.every(item => typeof item === 'string' ? extToMime(item).startsWith('image/') : item.type === 'image')
    const videos = paths.every(item => typeof item === 'string' ? extToMime(item).startsWith('video/') : item.type === 'video')
    if ((format === 'text' || format === 'link') && paths.length ||
      format === 'photo' && (paths.length !== 1 || !images) ||
      format === 'multi-photo' && (paths.length < 2 || !images) ||
      (format === 'video' || format === 'reel') && (paths.length !== 1 || !videos)) {
      throw new Error('Facebook attachments do not match --facebook-format')
    }
    if (format === 'text' && !(platformTexts?.facebook ?? fields.text).trim()) throw new Error('Facebook text format requires a caption')
    if (format === 'link') {
      let link: URL
      try { link = new URL(fields.facebookLink ?? '') } catch { throw new Error('--facebook-link must be a public HTTPS URL') }
      if (link.protocol !== 'https:' || link.username || link.password) throw new Error('--facebook-link must be a public HTTPS URL')
    }
    facebookOptions = { format: format as FacebookOptions['format'], ...(format === 'link' ? { link: fields.facebookLink } : {}) }
  }

  const altTexts = alignAltText(localMedia, fields.altText ?? [])

  const youtubeOptions = buildYoutubeOptions({
    ytTitle: fields.ytTitle,
    ytDescription: fields.ytDescription,
    ytTags: fields.ytTags,
    ytPrivacy: fields.ytPrivacy,
    ytCategory: fields.ytCategory,
    ytMadeForKids: fields.ytMadeForKids,
  })
  const instagramOptions = buildInstagramOptions({
    igReel: fields.igReel,
    igShareToFeed: fields.igShareToFeed,
    igCoverUrl: fields.igCoverUrl,
    igThumbOffsetMs: fields.igThumbOffsetMs,
    igCollaborators: fields.igCollaborators,
  })
  const threadsOptions = buildThreadsOptions({
    threadsReplyTo: fields.threadsReplyTo,
    threadsReplyControl: fields.threadsReplyControl,
  })

  // ── Account resolution (network: brands.authStatus + optional picker) ──
  const targetAccountIds = await resolveTargetAccounts({
    brandSlug: fields.brandSlug,
    platforms,
    accountFlags: fields.account ?? [],
    client,
    isTty: opts.isTty,
    emit: opts.emit,
  })

  const common = {
    brandSlug: fields.brandSlug,
    text: fields.text,
    platforms,
    ...(scheduledAt ? { scheduledAt } : {}),
    ...(fields.thread && fields.thread.length > 0 ? { thread: fields.thread } : {}),
    ...(platformTexts && Object.keys(platformTexts).length > 0 ? { platformTexts } : {}),
    ...(Object.keys(targetAccountIds).length > 0 ? { targetAccountIds } : {}),
    ...(instagramOptions ? { instagramOptions } : {}),
    ...(threadsOptions ? { threadsOptions } : {}),
    ...(youtubeOptions ? { youtubeOptions } : {}),
    ...(facebookOptions ? { facebookOptions } : {}),
    source: 'cli' as const,
  }

  if (opts.dryRun) {
    // Show the resolved request with media as LOCAL paths — nothing uploaded, nothing POSTed.
    return {
      dryRun: true,
      request: {
        ...common,
        ...(fields.media && fields.media.length > 0
          ? {
              media: sharedCanonicalMedia.length ? sharedCanonicalMedia : localMedia.map((path, i) => ({
                path,
                ...(altTexts[i] ? { altText: altTexts[i] } : {}),
              })),
            }
          : {}),
        ...(Object.keys(platformMediaPaths).length + Object.keys(canonicalMedia).length > 0 ? { platformMedia: { ...canonicalMedia, ...platformMediaPaths } } : {}),
      },
    }
  }

  opts.onBeforeNetwork?.()

  // Upload global media.
  const mediaInputs: MediaInput[] = [...sharedCanonicalMedia]
  for (let i = 0; i < localMedia.length; i++) {
    const filePath = localMedia[i]!
    const data = await fs.readFile(filePath)
    const filename = nodePath.basename(filePath)
    const uploaded = await client.media.upload({
      data: new Uint8Array(data),
      filename,
      contentType: extToMime(filename),
    })
    mediaInputs.push({
      url: uploaded.url,
      type: uploaded.type,
      ...(altTexts[i] ? { altText: altTexts[i] } : {}),
    })
  }

  // Upload per-platform media.
  const platformMediaResult: Partial<Record<Platform, MediaInput[]>> = { ...canonicalMedia }
  for (const [p, paths] of Object.entries(platformMediaPaths) as [Platform, string[]][]) {
    const uploads: MediaInput[] = []
    for (const filePath of paths) {
      const data = await fs.readFile(filePath)
      const filename = nodePath.basename(filePath)
      const uploaded = await client.media.upload({
        data: new Uint8Array(data),
        filename,
        contentType: extToMime(filename),
      })
      uploads.push({ url: uploaded.url, type: uploaded.type })
    }
    platformMediaResult[p] = uploads
  }

  return client.posts.create({
    ...common,
    ...(mediaInputs.length > 0 ? { media: mediaInputs } : {}),
    ...(Object.keys(platformMediaResult).length > 0 ? { platformMedia: platformMediaResult } : {}),
  })
}
