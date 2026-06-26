---
title: CLI v0.3.3 — media attachments (#31) + per-account selector (#35)
status: in-progress
priority: P2
effort: medium
branch: feat/cli-v0.3.3-media-account
tags: [cli, sdk, posts, media, accounts]
created: 2026-06-26
---

# CLI v0.3.3 — media (#31) + per-account selector (#35)

Two deferred features for `autoposting-cli`, shipped as lockstep v0.3.3
(`@autoposting.ai/sdk` + `@autoposting.ai/cli`). TDD: failing test first → green.

Both features land on **`posts create` only** — the backend create endpoint is the
sole place that accepts `media` / `platformMedia` / `targetAccountIds`. Backend
`publish` takes an empty body and `schedule` takes only `{scheduledAt,cancel}`, so
account/media targeting is fixed at create time; publish/schedule inherit it. This
is the root-cause placement, not a per-command patch.

## Backend contract (verified — source of truth, do not invent)

- **Media upload:** `POST /media/upload`, `multipart/form-data`, single file part
  (field name not validated → use `file`), ≤20MB, `image/*|video/*`.
  Response `{ success, data: { url, type: 'image'|'video'|'gif', filename } }`.
  (`backend/src/media/upload-media.step.ts:156-246`)
- **Create:** `POST /posts`, scope `posts:write`. Body
  (`backend/src/posts/create-post.step.ts:89-126`):
  - `media?: Array<{ url, type, altText? }>` (max 10)
  - `platformMedia?: Record<platform, media[]>`
  - `platformTexts?: Record<platform, string>`
  - `targetAccountIds?: Record<platform, string[]>`  (values = `platformUserId`; omit ⇒ backend posts to ALL accounts of that platform)
  - `instagramOptions?: { reel?: { thumbOffsetMs?, shareToFeed?, coverUrl?, collaborators? } }`
  - `threadsOptions?: { replyToId?, replyControl? }`
  - `youtubeOptions?: { title?, description?, tags?, privacyStatus?, madeForKids?, categoryId? }`
- **List accounts:** `GET /brands/:slug/auth/status` (already wired to `brands auth-status`),
  each entry has `platform`, `connected`, `platformUserId`, `platformUsername`,
  `platformAccountType`, `profileImageUrl`. Multiple entries per platform possible.
  (`backend/src/auth/auth-status.step.ts:13-98`)
- All endpoints accept API-key auth.

## Pinned SDK contract (CLI codes against this; SDK-agent implements it)

```ts
// types/posts.ts
export interface MediaInput { url: string; type: 'image' | 'video' | 'gif'; altText?: string }
export interface InstagramOptions { reel?: { thumbOffsetMs?: number; shareToFeed?: boolean; coverUrl?: string; collaborators?: string[] } }
export interface ThreadsOptions { replyToId?: string; replyControl?: string }
export interface YoutubeOptions { title?: string; description?: string; tags?: string[]; privacyStatus?: string; madeForKids?: boolean; categoryId?: string }

export interface CreatePostParams {
  brandSlug: string
  text: string
  platforms: Platform[]
  scheduledAt?: string
  thread?: string[]
  media?: MediaInput[]                                  // FIX: was string[] (wrong vs backend)
  platformMedia?: Partial<Record<Platform, MediaInput[]>>
  platformTexts?: Partial<Record<Platform, string>>
  targetAccountIds?: Partial<Record<Platform, string[]>>
  instagramOptions?: InstagramOptions
  threadsOptions?: ThreadsOptions
  youtubeOptions?: YoutubeOptions
  source?: 'api' | 'mcp' | 'cli' | 'dashboard' | 'agent'
}

// resources/media.ts (new)
export interface MediaUpload { data: Uint8Array | Blob; filename: string; contentType?: string }
export interface UploadedMedia { url: string; type: 'image' | 'video' | 'gif'; filename: string }
class MediaResource { upload(file: MediaUpload): Promise<UploadedMedia> }   // POST /media/upload (FormData)
// client.media: MediaResource

// types/brands.ts — PlatformConnection gains:
platformUserId?: string
platformAccountType?: 'personal' | 'organization'
profileImageUrl?: string
```

`client.request()` already supports FormData (`client.ts:169-193`); media.upload builds
a FormData with a Blob part and calls request('POST','/media/upload', form).
`source: 'cli'` is set by the CLI on every create.

## Phases (parallel by package — no shared files)

- **phase-01-sdk** — `packages/sdk` only. MediaResource + type fixes + new params +
  PlatformConnection fields + msw tests. Owner: SDK-agent.
- **phase-02-cli** — `packages/cli` only. New `posts create` flags, media-upload
  orchestration, account picker, parsers + execa tests. Adds `@inquirer/prompts`.
  Owner: CLI-agent. Codes against the pinned SDK contract above.
- **phase-03-integrate** (controller, sequential after 1+2) — build SDK→CLI, run full
  suite, code-reviewer, pre-PR gates, changeset→0.3.3, PR→merge→tag→verify.

## Acceptance criteria

### #31 media + platform flags (create)
1. `--media <path...>` uploads each file (`/media/upload`), attaches `media:[{url,type,altText?}]`.
2. `--alt-text <text...>` aligns to `--media` by index.
3. `--platform-text <p=text...>` → `platformTexts`; `--platform-media <p=path,path...>` → uploads → `platformMedia`.
4. `--yt-title/--yt-description/--yt-tags/--yt-privacy/--yt-category/--yt-made-for-kids` → `youtubeOptions`.
5. `--ig-reel/--ig-share-to-feed/--ig-cover-url/--ig-thumb-offset-ms/--ig-collaborators` → `instagramOptions.reel`.
6. `--threads-reply-to/--threads-reply-control` → `threadsOptions`.
7. Errors: missing file → clear message; >10 media → reject pre-flight; malformed `p=v` pair → error; unknown platform in pair → error.
8. SDK `media.upload` posts multipart and unwraps `{url,type,filename}`; `CreatePostParams.media` retyped.

### #35 per-account selector (create)
9. `--account <p=handle|id...>` resolves handle→`platformUserId` via `auth-status` → `targetAccountIds`.
10. Ambiguous (≥2 accounts on a targeted platform, no `--account` for it) + TTY → interactive multiselect; non-TTY → error listing accounts, non-zero exit.
11. Single account on a platform → no prompt, no error (omit that platform from targetAccountIds).
12. Unknown handle/id in `--account` → error listing valid accounts.

### Out of scope
- Media/account flags on update/publish/schedule (backend doesn't accept them there).
- Editing media on existing posts; new dependencies beyond `@inquirer/prompts`.

## Constraints
- TDD red→green per phase. Match existing CLI (Commander) + SDK (resource class) patterns.
- Lockstep changeset `fixed` group → both bump 0.3.2 → 0.3.3.
- Public contracts: `CreatePostParams.media` changes `string[]`→`MediaInput[]` (intentional, callout in changeset; CLI never used the old shape so no real consumer breaks).
- Release: PR → merge main → `changeset version` → tag `v0.3.3` → CI publishes (same as v0.3.2).

## Pre-PR gates (Phase 4 — all green before PR)
ck:test · ck:code-review · ck:security · security-review · no-mistakes.
react-doctor / UI-UX gates: N/A (CLI/SDK, no frontend).

## Risks
- @inquirer/prompts adds a CLI runtime dep — acceptable, no native multiselect. Non-TTY path keeps tests deterministic.
- Build-order: CLI execa tests spawn built `dist/cli.cjs` → SDK must build before CLI integration test (handled in phase-03, not in parallel).
- Multipart in Node: use Blob from Uint8Array; verify Node 20 fetch FormData works in SDK test (msw supports it).
