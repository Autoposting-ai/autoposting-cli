import fs from 'node:fs/promises'
import nodePath from 'node:path'
import type { Autoposting, MediaInput, Platform } from '@autoposting.ai/sdk'
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

const VALID_PLATFORMS: readonly Platform[] = ['x', 'linkedin', 'instagram', 'threads', 'youtube']

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

/** One post's inputs — same field names as `posts create` opts, brand already resolved. */
export interface PostFields {
  brandSlug: string
  text: string
  platforms: string
  at?: string
  thread?: string[]
  media?: string[]
  altText?: string[]
  platformText?: string[]
  platformMedia?: string[]
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

  if (fields.media && fields.media.length > 0) {
    validateMediaCount(fields.media)
    validateMediaPaths(fields.media)
    validateMediaExtensions(fields.media)
  }

  const platformTexts =
    fields.platformText && fields.platformText.length > 0
      ? parsePairs('--platform-text', fields.platformText)
      : undefined

  const platformMediaPaths =
    fields.platformMedia && fields.platformMedia.length > 0
      ? parsePlatformMediaPairs('--platform-media', fields.platformMedia)
      : {}
  for (const paths of Object.values(platformMediaPaths)) {
    validateMediaPaths(paths)
    validateMediaExtensions(paths)
  }

  const altTexts = alignAltText(fields.media ?? [], fields.altText ?? [])

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
              media: fields.media.map((path, i) => ({
                path,
                ...(altTexts[i] ? { altText: altTexts[i] } : {}),
              })),
            }
          : {}),
        ...(Object.keys(platformMediaPaths).length > 0 ? { platformMedia: platformMediaPaths } : {}),
      },
    }
  }

  opts.onBeforeNetwork?.()

  // Upload global media.
  const mediaInputs: MediaInput[] = []
  for (let i = 0; i < (fields.media ?? []).length; i++) {
    const filePath = fields.media![i]!
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
  const platformMediaResult: Partial<Record<Platform, MediaInput[]>> = {}
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
