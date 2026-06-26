import { existsSync } from 'node:fs'
import type { Platform, MediaInput, InstagramOptions, ThreadsOptions, YoutubeOptions } from '@autoposting.ai/sdk'

export type { MediaInput, InstagramOptions, ThreadsOptions, YoutubeOptions }

const VALID_PLATFORMS: readonly Platform[] = ['x', 'linkedin', 'instagram', 'threads', 'youtube']

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
}

/** Maps a filename's extension to a MIME type. Throws on unknown extensions. */
export function extToMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const mime = EXT_TO_MIME[ext]
  if (!mime) {
    throw new Error(
      `Unsupported file extension ".${ext || '(none)'}" in "${filename}". ` +
      `Supported: ${Object.keys(EXT_TO_MIME).join(', ')}`,
    )
  }
  return mime
}

/** Parses "platform=value" strings into a platform-keyed record. */
export function parsePairs(flag: string, vals: string[]): Partial<Record<Platform, string>> {
  const result: Partial<Record<Platform, string>> = {}
  for (const val of vals) {
    const eqIdx = val.indexOf('=')
    if (eqIdx < 1) {
      throw new Error(`${flag}: expected "platform=value" format, got "${val}"`)
    }
    const p = val.slice(0, eqIdx).trim()
    const v = val.slice(eqIdx + 1)
    if (!VALID_PLATFORMS.includes(p as Platform)) {
      throw new Error(`${flag}: unknown platform "${p}". Valid: ${VALID_PLATFORMS.join(', ')}`)
    }
    result[p as Platform] = v
  }
  return result
}

/** Parses "platform=path1[,path2,...]" strings into a platform-keyed path-array record. */
export function parsePlatformMediaPairs(
  flag: string,
  vals: string[],
): Partial<Record<Platform, string[]>> {
  const result: Partial<Record<Platform, string[]>> = {}
  for (const val of vals) {
    const eqIdx = val.indexOf('=')
    if (eqIdx < 1) {
      throw new Error(`${flag}: expected "platform=path[,path...]" format, got "${val}"`)
    }
    const p = val.slice(0, eqIdx).trim()
    const paths = val
      .slice(eqIdx + 1)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!VALID_PLATFORMS.includes(p as Platform)) {
      throw new Error(`${flag}: unknown platform "${p}". Valid: ${VALID_PLATFORMS.join(', ')}`)
    }
    result[p as Platform] = paths
  }
  return result
}

/** Validates that every path has a supported extension. Throws on the first bad one.
 *  Lets `posts create` reject unsupported media before any network call/upload. */
export function validateMediaExtensions(paths: string[]): void {
  for (const p of paths) extToMime(p)
}

/** Throws if more than 10 media paths are provided (backend limit). */
export function validateMediaCount(paths: string[]): void {
  if (paths.length > 10) {
    throw new Error(`--media accepts at most 10 files (received ${paths.length}).`)
  }
}

/** Validates that all media file paths exist on disk. */
export function validateMediaPaths(paths: string[]): void {
  for (const p of paths) {
    if (!existsSync(p)) {
      throw new Error(`Media file not found: "${p}"`)
    }
  }
}

/**
 * Aligns alt-text strings to media paths by index.
 * Returns undefined for indices with no alt-text.
 * Throws if altTexts.length > mediaPaths.length.
 */
export function alignAltText(
  mediaPaths: string[],
  altTexts: string[],
): Array<string | undefined> {
  if (altTexts.length > mediaPaths.length) {
    throw new Error(
      `--alt-text has more values (${altTexts.length}) than --media (${mediaPaths.length}). ` +
      `Alt text aligns to media by index.`,
    )
  }
  return mediaPaths.map((_, i) => altTexts[i])
}

/** Builds YoutubeOptions from CLI flag values; returns undefined if all fields are empty. */
export function buildYoutubeOptions(opts: {
  ytTitle?: string
  ytDescription?: string
  ytTags?: string
  ytPrivacy?: string
  ytCategory?: string
  ytMadeForKids?: boolean
}): YoutubeOptions | undefined {
  const { ytTitle, ytDescription, ytTags, ytPrivacy, ytCategory, ytMadeForKids } = opts
  const o: YoutubeOptions = {}
  if (ytTitle) o.title = ytTitle
  if (ytDescription) o.description = ytDescription
  if (ytTags) o.tags = ytTags.split(',').map((t) => t.trim()).filter(Boolean)
  if (ytPrivacy) o.privacyStatus = ytPrivacy
  if (ytCategory) o.categoryId = ytCategory
  if (ytMadeForKids !== undefined) o.madeForKids = ytMadeForKids
  return Object.keys(o).length > 0 ? o : undefined
}

/** Builds InstagramOptions from CLI flag values; returns undefined if no IG flags are set. */
export function buildInstagramOptions(opts: {
  igReel?: boolean
  igShareToFeed?: boolean
  igCoverUrl?: string
  igThumbOffsetMs?: string
  igCollaborators?: string
}): InstagramOptions | undefined {
  const { igReel, igShareToFeed, igCoverUrl, igThumbOffsetMs, igCollaborators } = opts
  const hasAnyReelFlag = igReel !== undefined || igShareToFeed !== undefined ||
    igCoverUrl !== undefined || igThumbOffsetMs !== undefined || igCollaborators !== undefined
  if (!hasAnyReelFlag) return undefined

  const reel: NonNullable<InstagramOptions['reel']> = {}
  // --ig-reel presence alone signals reel mode to the backend; no field to set
  if (igShareToFeed !== undefined) reel.shareToFeed = igShareToFeed
  if (igCoverUrl) reel.coverUrl = igCoverUrl
  if (igThumbOffsetMs !== undefined) {
    const n = Number(igThumbOffsetMs)
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(
        `--ig-thumb-offset-ms must be a non-negative number (received "${igThumbOffsetMs}")`,
      )
    }
    reel.thumbOffsetMs = n
  }
  if (igCollaborators) {
    reel.collaborators = igCollaborators.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return { reel }
}

/** Builds ThreadsOptions from CLI flag values; returns undefined if no flags are set. */
export function buildThreadsOptions(opts: {
  threadsReplyTo?: string
  threadsReplyControl?: string
}): ThreadsOptions | undefined {
  const { threadsReplyTo, threadsReplyControl } = opts
  if (!threadsReplyTo && !threadsReplyControl) return undefined
  const o: ThreadsOptions = {}
  if (threadsReplyTo) o.replyToId = threadsReplyTo
  if (threadsReplyControl) o.replyControl = threadsReplyControl
  return o
}
