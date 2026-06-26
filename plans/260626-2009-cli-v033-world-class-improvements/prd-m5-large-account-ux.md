---
title: "PRD — M5: Large-account-list ergonomics"
status: proposed
severity: MED
effort: M
confidence: MED (codebase-verified mechanism; UX assumptions secondary)
batch: v0.3.4 "world-class"
created: 2026-06-26
---

> Auto-generated from research findings. DECISION NEEDED + LOW-confidence items require human judgment.

# M5 — Large-account-list ergonomics

## Problem statement

A single brand can connect many accounts of one platform. Real data this session:
brand `udit-goenka` has **23 LinkedIn orgs + 2 X accounts**. The current account
selector (`packages/cli/src/lib/account-select.ts`) handles 2–3 accounts well but
does not scale to 23:

- **No "all" shortcut.** `--account p=handle|id` resolves exactly one account per
  flag (line 47, `accountMap[p] = value`; line 69–90 resolves a single match).
  Targeting every connected LinkedIn org means listing 23 handles by hand.
- **No type-to-filter.** The interactive picker (line 92–104) is a plain
  `@inquirer/prompts` `checkbox` over `accounts.map(...)` — a flat 23-item
  scroll, no search.
- **No saved default.** With ≥2 connected accounts and non-TTY, it throws and
  demands `--account` every run (line 105–117). A 2-account brand re-prompts (or
  re-errors) **forever** because nothing persists the choice.

The improvement plan ranks this `confidence: MED · effort: M` and identifies
"(a) `=all` + (c) saved default" as the high-value, low-cost pair.

## User stories

ICP: developers / technical marketers / agencies running multi-account brands.

- As an agency managing a brand with 23 LinkedIn orgs, I want
  `--account linkedin=all` to fan out to **every** connected LinkedIn account in
  one flag, so I don't paste 23 handles into a script.
- As an operator at an interactive shell, when a platform has 23 accounts I want
  to **type a few characters to filter** the picker instead of scrolling a wall
  of 23 rows.
- As a scripter with a steady 2-account brand, I want to set a **default
  account** once (`ap brands set-default-account <brand> x=@handle`) so my
  non-interactive `ap posts create` stops erroring/prompting every run.
- As a CI author, I want `=all` to be explicit and auditable (it should print
  which N accounts it resolved) so a fan-out is never silent.

## Requirements (MoSCoW)

### Functional

- **MUST** — `--account <platform>=all` (and alias `=*`) resolves to **all
  connected** accounts of that platform for the brand. Surfaces the resolved
  count/list so the fan-out is visible.
- **MUST** — `ap brands set-default-account <brand> <platform>=<handle|id>`
  persists a per-brand, per-platform default; subsequent posts use it when no
  `--account` is given and skip the prompt/error.
- **MUST** — `ap brands get-default-account <brand>` (or surface in an existing
  brands view) and a way to clear it.
- **SHOULD** — interactive picker becomes type-to-filter (search) once a platform
  has more than a threshold (e.g. ≥8) connected accounts.
- **SHOULD** — precedence is explicit and documented:
  `--account` flag > saved default > interactive picker (TTY) > error (non-TTY).
- **COULD** — `=all` combinable with exclusions later (out of scope now).
- **COULD** — `set-default-account <brand> <platform>=all` to persist a fan-out
  default.
- **WON'T** (this batch) — account groups/aliases, cross-brand defaults,
  glob/regex handle matching beyond `all`/`*`.

### Non-functional

- **MUST** — `=all` is opt-in and explicit; the existing "0 or 1 account → omit,
  backend posts to all connected" behavior (line 119) is unchanged.
- **MUST** — saved defaults persist with the same security posture as
  credentials (0600 file, owner-only dir) — reuse the existing store, don't
  invent a new location.
- **SHOULD** — filter UX degrades gracefully on non-TTY (no prompt; uses default
  or errors with the connected-account list it already prints).

## Acceptance criteria

1. `resolveTargetAccounts` test: `--account linkedin=all` with 23 connected
   LinkedIn accounts → `result.linkedin` contains all 23 `platformUserId`s.
2. Test: `=all` for a platform with 0 connected accounts → clear error or
   documented no-op (not a crash).
3. Test: `=*` behaves identically to `=all`.
4. Persistence test: `set-default-account udit-goenka x=@handle` writes the
   default; a subsequent non-TTY `posts create` with no `--account` resolves that
   account and does **not** throw the "no --account specified" error
   (account-select.ts:108–116).
5. Precedence test: an explicit `--account` overrides the saved default.
6. TTY picker test: with ≥8 accounts, typing filters the choice list; selecting
   returns the chosen `platformUserId`s.
7. Resolved fan-out is printed (e.g. "linkedin: targeting 23 accounts") so `=all`
   is auditable.

## Technical approach (suggested starting points)

> Reuse the existing selector and credential store; add a small "all" branch and
> a per-brand defaults map. No new dependency — `@inquirer/prompts` already
> supports searchable prompts.

- **`=all` resolution** — `packages/cli/src/lib/account-select.ts`
  `resolveTargetAccounts`. In the per-platform loop (line 65), before the
  single-match block, special-case `specifiedValue === 'all' || '*'` →
  `result[platform] = accounts.map(a => a.platformUserId).filter(Boolean)`. The
  `accounts` array is already grouped by platform (line 55–61, `byPlatform`), so
  "all connected" is in hand.
- **Type-to-filter picker** — replace the `checkbox` import (line 94) for the
  large-list case with `@inquirer/prompts`' searchable/checkbox-with-filter
  variant (the dep is already used, lazy-imported to keep it off non-TTY paths —
  preserve that). Gate on `accounts.length >= THRESHOLD` so small lists keep the
  current simple checkbox.
- **Saved defaults — reuse the credential store pattern** —
  `packages/cli/src/auth/credential-store.ts` already implements an atomic,
  0600, XDG-located JSON store (`~/.config/autoposting/...`). Add a sibling
  `config.json` (or extend the credentials schema with a `defaults` map keyed by
  `brand` → `{ platform: handle|id|'all' }`). **Do not** invent a new storage
  location — `getCredentialsPath()`'s XDG logic (line 17–23) and the atomic
  temp-write+rename pattern (line 36–62) are the precedent to copy. This also
  seeds the N1 default-context PRD's store.
- **Reading the default** — in `resolveTargetAccounts`, when `accountMap[platform]`
  is undefined, fall back to the saved default for `(brandSlug, platform)` before
  the ≥2-accounts prompt/throw branches (line 91/105). Keep the precedence
  explicit and tested.
- **`brands set-default-account` command** — add subcommands to
  `packages/cli/src/commands/brands.ts`, parsing `platform=value` with the
  existing `parsePairs` helper (`lib/media-flags.ts:33`) for format consistency.

## Risks + confidence

- **Confidence: MED.** The *mechanism* is HIGH-confidence (verified
  `account-select.ts` and `credential-store.ts` directly). The *UX choices*
  (filter threshold, default precedence, whether agencies want `=all` vs.
  explicit lists for safety) are MED — they are product judgment, not codebase
  facts.
- **Risk: `=all` is a footgun for blast radius.** Fanning out to 23 orgs in one
  flag is powerful and irreversible once published. Mitigate by printing the
  resolved count and (DECISION) possibly requiring a confirm on large fan-outs in
  TTY mode.
- **Risk: saved defaults drift.** A persisted default can point at a
  disconnected/rotated account. Resolution must still validate against live
  `authStatus` (line 52) and error clearly, not post to a stale id.
- **Low risk: storage.** Reusing the credential-store pattern keeps the security
  posture; the only risk is schema coupling if defaults live *inside*
  credentials.json (a corrupt-file rename already exists at line 69–75).
- Secondary evidence: aws/gh/kubectl named-context + default patterns (web).

## DECISION NEEDED

1. **`=all` confirmation.** Should a large fan-out (e.g. >N accounts) require an
   interactive confirm in TTY mode, or always run silently with a printed count?
   (Recommend: print count always; confirm above a threshold in TTY only.)
2. **Storage shape.** Per-brand defaults in a **new** `config.json` (clean
   separation, also serves N1) vs. **extending** `credentials.json` with a
   `defaults` map (one file, but couples config to secrets). Recommend a separate
   `config.json` reusing the same store helpers.
3. **Filter threshold.** At what account count does the picker switch from plain
   checkbox to searchable? (Proposed ≥8 — needs a human call.)

## Open questions

- Does `PlatformConnection` expose a stable display name beyond
  `platformUsername`/`platformUserId` (used at account-select.ts:79,107) to make
  a 23-item filtered list readable (org names, not just handles)? Confirm fields.
- Should `set-default-account` validate the handle against live `authStatus` at
  write time, or only at use time? (Recommend write-time validate + use-time
  re-check.)
- Is `=all` desired for X (2 accounts) too, or is it a LinkedIn-scale feature?
  (Recommend platform-agnostic — it's the same code path.)
