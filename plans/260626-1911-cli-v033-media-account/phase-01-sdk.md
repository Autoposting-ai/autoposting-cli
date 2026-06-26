# Phase 01 — SDK (`packages/sdk`)

Owner: SDK-agent. Touch **only** `packages/sdk/`. Implements the pinned SDK contract in `plan.md`.

## Files
- **new** `packages/sdk/src/resources/media.ts` — `MediaResource.upload()`.
- `packages/sdk/src/resources/index.ts` (or wherever resources are registered) — wire `media`.
- `packages/sdk/src/client.ts` — add `media: MediaResource` to the client (match how `posts`/`brands` are attached).
- `packages/sdk/src/types/posts.ts` — add `MediaInput`, `InstagramOptions`, `ThreadsOptions`, `YoutubeOptions`; retype `CreatePostParams.media` `string[]`→`MediaInput[]`; add `platformMedia`, `platformTexts`, `targetAccountIds`, `*Options`, `source`.
- `packages/sdk/src/types/brands.ts` — `PlatformConnection` += `platformUserId?`, `platformAccountType?`, `profileImageUrl?`.
- `packages/sdk/src/index.ts` — export new types.
- **new** `packages/sdk/src/__tests__/media.test.ts` — msw.

## Steps (TDD)
1. **RED** `media.test.ts`: `media.upload()` POSTs `multipart/form-data` to `/media/upload` with a file part; unwraps `{success,data}` envelope → returns `{url,type,filename}`. Assert request content-type is multipart (msw: inspect `request.headers`/body). Use the `wrap()` envelope helper pattern from `agents.test.ts`.
2. Implement `MediaResource.upload(file)`: build `FormData`, append `new Blob([file.data], { type: file.contentType })` as `file` with `file.filename`, `return this.client.request<UploadedMedia>('POST','/media/upload', form)`. Do NOT set Content-Type manually (fetch sets the multipart boundary).
3. Wire `client.media`.
4. Types: add the interfaces, retype `media`, add new optional params + PlatformConnection fields. Export.
5. **GREEN** run `npm test` in `packages/sdk` + `npm run build` (tsup) + `tsc --noEmit`.

## Acceptance (from plan.md): #31.8, #35 type support (platformUserId on PlatformConnection)
- `media.upload` multipart + unwrap verified by msw test.
- `tsc` clean; existing SDK tests still green (the `media` retype must not break existing posts tests — check `__tests__/posts*.test.ts` and fix any now that media was `string[]`).

## Notes
- Backend `media.type` is `image|video|gif`. Keep that union.
- Verify Node-20 `FormData`/`Blob` available (global in Node 18+). msw `http` can read the multipart body; if asserting exact bytes is flaky, assert the part filename + that a file part exists.
