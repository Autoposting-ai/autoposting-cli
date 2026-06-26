---
title: v0.3.3 fold-ins — M3 unschedule + M4 fail-fast media validation
status: in-progress
priority: P1
effort: small
branch: feat/cli-v0.3.3-media-account
tags: [cli, sdk, posts, validation, release]
created: 2026-06-26
---

# v0.3.3 fold-ins: M3 (unschedule) + M4 (fail-fast media)

Two small, verified additions folded into the v0.3.3 release (on top of #31 media
flags + #35 account selector, already code-complete + 110-story green). TDD: red → green.

## Verified contracts (not invented)
- **M3 unschedule:** backend `schedule-post.step.ts:22` = "Schedule or cancel scheduling".
  Reads `{ scheduledAt, cancel }`; `cancel:true` → atomic `findOneAndUpdate` post in
  `['draft','scheduled']` → set `status:'draft'`, `$unset scheduledAt`; returns
  `{ success:true, data:{ id, status:'draft' } }`; 409 if wrong state. Endpoint:
  `PUT /posts/:id/schedule` (idempotent → SDK retry already safe).
- **M4:** `extToMime` (media-flags.ts:20) already throws on bad ext, but is only called
  inside the upload loops (posts.ts:283,303) — AFTER `resolveTargetAccounts` (network).
  Count/path checks already run in the pure pass (posts.ts:224-241). Gap = ext check
  is not in that pass.

## Acceptance criteria
M3:
- `ap posts schedule <id> --cancel` → SDK `unschedule(id)` → `PUT /posts/:id/schedule {cancel:true}`, prints draft post.
- `--at` becomes optional; exactly one of `--at`/`--cancel` required → else clear error, exit 6/1.
- `--at <past>` still rejected (unchanged); `--cancel` skips time validation.
M4:
- `ap posts create --media bad.bmp` (file exists, unsupported ext) → fails BEFORE any
  network call (no GET /auth/status, no upload) with "Unsupported file extension".
- Same for `--platform-media x=bad.bmp`.
- Valid extensions unaffected; existing 3 happy-path live-stub tests stay green.

## Files
- `packages/sdk/src/resources/posts.ts` — add `unschedule(id)`.
- `packages/sdk/src/__tests__/posts.test.ts` — red test for unschedule body.
- `packages/cli/src/lib/media-flags.ts` — add `validateMediaExtensions(paths)`.
- `packages/cli/src/commands/posts.ts` — schedule cmd `--cancel` + optional `--at` + mutual-exclusion; call `validateMediaExtensions` in create pure pass.
- `packages/cli/src/__tests__/posts-schedule.test.ts` — new: --cancel / mutual-exclusion (live stub + format).
- `packages/cli/src/__tests__/posts-create-media.test.ts` — add M4 fail-fast-ext tests.

## Steps (TDD)
1. Red: SDK unschedule test + CLI schedule --cancel/mutual-exclusion test + CLI M4 fail-fast-ext tests. Run → fail.
2. Green: implement SDK `unschedule`, CLI schedule flags, `validateMediaExtensions` + wire into pure pass. Run → pass.
3. Build sdk+cli, full vitest suite, typecheck.
4. Pre-PR gates: ck:test, ck:code-review, ck:security, security-review, no-mistakes.
5. Changeset (fixed group) 0.3.2 → 0.3.3 → PR → merge → tag v0.3.3 → CI publish → README + npm verify.

## Risks / rollback
- Making `--at` optional could mask a missing-time mistake → mitigated by required-one-of guard.
- Surgical, additive; revert = drop `unschedule` + `--cancel` + `validateMediaExtensions` call.
