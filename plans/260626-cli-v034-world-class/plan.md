---
title: CLI v0.3.4 "world-class" — M2 + M5 + N1 + N2 + N3
status: in-progress
priority: P1
effort: large
branch: feat/cli-v0.3.4-world-class
tags: [cli, sdk, output, config, bulk]
created: 2026-06-26
---

# v0.3.4 — world-class CLI batch

Five PRD items (M2, M5, N1, N2, N3) from `plans/260626-2009-cli-v033-world-class-improvements/`.
M1 (idempotency) excluded — backend-blocked. Each independently shippable; built in
dependency order. TDD red→green per feature. Both packages version-locked to 0.3.4
(changeset `fixed`).

## Resolved decisions (user)
- Scope: all five incl. N3 bulk.
- M2: flip default output to `auto` now (TTY→table, non-TTY→JSON; explicit `--format`/`--json`/`--quiet` win).
- M2 `--jq`: minimal built-in subset, zero deps, exit non-zero on bad expr (ponytail ceiling).
- M5 `=all`: always print resolved fan-out count; TTY-confirm above threshold (>5); non-TTY silent w/ count.
- M5/N1 store: separate `~/.config/autoposting/config.json` (0600), credential-store atomic pattern.
- M5 picker: searchable variant at ≥8 accounts.
- N1: shares config.json; `resolveBrand(opts)=opts.brand ?? savedContext`; applied to brand-scoped cmds.
- N2: `--dry-run`/`--preview` on `posts create` only; no upload, no POST; fail-fast validation still runs.
- N3: `--from <csv|json>`; sequential; per-row summary; partial-failure exit non-zero; JSON-first; weak re-run caveat documented (until M1).

## Phases
- **P0 config-store** — `auth/config-store.ts` (context + per-brand default accounts), 0600, atomic. → `phase-01`
- **P1 M2** — `formatter`/`cli.ts` `auto` default + global `--jq`; printer applies jq. → `phase-02`
- **P2 N1** — `commands/config.ts` (set/get/unset-context) + `resolveBrand` on `posts list`/`create`. → `phase-03`
- **P3 M5** — `account-select` `=all`/`=*` + saved-default fallback + count/confirm + searchable picker; `brands set/get/clear-default-account`. → `phase-04`
- **P4 refactor** — extract single-post assembly into `lib/post-create.ts` (`buildAndCreatePost`), keep media/account tests green. → `phase-05`
- **P5 N2** — `--dry-run`/`--preview` on create (uses buildAndCreatePost dry branch). → `phase-06`
- **P6 N3** — `--from <file>` bulk loop + summary + partial-failure. → `phase-07`
- **P7 CI gate** — `release.yml` assert built `dist/cli.cjs --version` == tag. → `phase-08`
- **P8 release** — changeset → version 0.3.4 → READMEs → pre-PR gates → PR → CI → tag → publish → verify live.

## Acceptance (top-level)
- detectOutputMode: unset+non-TTY→json, +TTY→tty; `--format table`+non-TTY→tty. `--jq '.[].id'` prints ids, bad expr non-zero no stack.
- `=all` w/ N accounts → N ids; `=*`==`=all`; prints count; saved default resolves non-TTY w/o throw; explicit overrides default.
- `config set-context --brand X` → `posts list` (no --brand) uses X; `--brand Y` overrides; `unset-context` clears.
- `--dry-run` → no POST /posts (and no media upload); exit 0; validation still fails fast.
- `--from f.json` N rows → N created, summary, exit 0; one bad row → others created, exit non-zero.
- All existing tests green; typecheck + build clean; npm audit 0.
