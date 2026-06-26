# Phase 02 — CLI (`packages/cli`)

Owner: CLI-agent. Touch **only** `packages/cli/`. Codes against the pinned SDK contract in `plan.md`
(SDK-agent implements it in parallel; the types/methods are agreed — import them).

## Files
- `packages/cli/src/commands/posts.ts` — extend **`create`** only (lines ~133-170): add flags, upload orchestration, account resolution, build the new body fields.
- **new** `packages/cli/src/lib/media-flags.ts` — pure parsers: `parsePairs('--platform-text', vals)` → `Record<platform,string>`; media-path validation; >10 guard; alt-text alignment. Keep parse logic pure + unit-testable.
- **new** `packages/cli/src/lib/account-select.ts` — resolve `--account` pairs + interactive picker. `resolveTargetAccounts({ brandSlug, platforms, accountFlags, client, isTty })` → `targetAccountIds` or throws a CLI error listing accounts. Uses `client.brands.authStatus(slug)` (the method behind `brands auth-status`) → group by platform → if ≥2 and unspecified: TTY ⇒ `@inquirer/prompts` checkbox, non-TTY ⇒ throw.
- `packages/cli/package.json` — add dependency `@inquirer/prompts`.
- **new** `packages/cli/src/__tests__/posts-create-media.test.ts`, `posts-create-account.test.ts` — execa.
- Unit tests for the pure parsers (`media-flags.test.ts`) — vitest, no spawn.

## New `posts create` flags
`--media <path...>` `--alt-text <text...>` `--platform-text <p=text...>` `--platform-media <p=path,path...>`
`--yt-title <t>` `--yt-description <d>` `--yt-tags <list>` `--yt-privacy <v>` `--yt-category <id>` `--yt-made-for-kids`
`--ig-reel` `--ig-share-to-feed` `--ig-cover-url <url>` `--ig-thumb-offset-ms <n>` `--ig-collaborators <list>`
`--threads-reply-to <id>` `--threads-reply-control <v>`
`--account <p=handle|id...>`

## Steps (TDD)
1. **RED** parser unit tests + execa tests for: media upload→attach, alt-text alignment, platform-text/media parse, yt/ig/threads option mapping, >10 reject, malformed pair, unknown platform; account: handle→id resolve, ambiguous non-TTY error, single-account no-prompt, unknown handle error. Mock SDK at the network layer where execa tests run the real binary — these need a mock API; reuse the existing CLI test approach (the execa tests run against env; for upload/account, point the SDK base URL at a local msw/http stub OR assert the pre-flight validation paths that fail before any network). Prefer asserting parse/validation + the non-TTY account error (deterministic, no network) for execa; cover the upload-body assembly via the pure-function unit tests + an SDK-level stub.
2. Implement parsers in `media-flags.ts` (pure) → green unit tests.
3. Implement upload orchestration in `create`: read each `--media` path (`fs.readFile`→Uint8Array), `client.media.upload({data,filename,contentType})` (contentType from extension via a small ext→mime map; reject unknown ext), collect `{url,type,altText}`. Same for `--platform-media`.
4. Implement `account-select.ts` + wire into create before building body.
5. Map yt/ig/threads flags → option objects (omit empties).
6. Set `source: 'cli'` on every create body.
7. **GREEN**: `npm run build` (needs SDK built first — controller handles order in phase-03; for local green, build SDK then CLI), `npm test` in `packages/cli`, `tsc --noEmit`.

## Acceptance (from plan.md): #31.1-7, #35.9-12
- All new flags map to the right body fields; errors are clear + exit non-zero.
- Non-TTY ambiguous-account path errors deterministically (this is what execa tests assert; no interactive prompt in CI).
- Existing `posts create` behavior (brand/text/platforms/at/thread) unchanged.

## Notes
- contentType ext map: jpg/jpeg→image/jpeg, png→image/png, gif→image/gif, webp→image/webp, mp4→video/mp4, mov→video/quicktime, webm→video/webm. Unknown ext → error.
- `--account` value forms: `x=@handle` (strip leading @), `x=1789...` (numeric id). Resolve against authStatus entries by matching `platformUsername` (case-insensitive, optional @) OR `platformUserId`.
- Picker: `@inquirer/prompts` `checkbox`; only when `process.stdout.isTTY`. Keep import lazy (dynamic import) so non-TTY/test paths never load it.
- Do not touch update/publish/schedule.
