---
title: autoposting-cli — world-class improvement plan (v0.3.3 + follow-ups)
status: proposed
priority: P1
effort: mixed
branch: feat/cli-v0.3.3-media-account
tags: [cli, sdk, ux, release]
created: 2026-06-26
---

# autoposting-cli → world-class social CLI: improvement plan

Source: `/autoresearch:improve` (predict→reason). Evidence = this session's live
e2e + 110-story regression + real prod API contract (primary), plus external bar
(clig.dev, gh/stripe CLI, Typefully/Buffer/Hypefury) (secondary).

**ICP:** developers / technical marketers / agencies automating multi-account,
multi-platform posting from a terminal or CI — the people who hit a brand with
23 LinkedIn orgs + 2 X accounts and want it scriptable, idempotent, and safe.

## World-class bar (what "great" looks like, and where we sit)

| Bar (who sets it) | World-class behavior | autoposting-cli today | Gap |
|---|---|---|---|
| Scripting (gh, clig.dev) | stdout not a TTY → auto machine-readable; `--jq` built in | default `--format table` renders TTY tables even when piped; JSON only on explicit `--json` | **HIGH** — footgun; also root cause class of the picker hang |
| Mutation safety (stripe) | idempotency key on every POST → safe retry, no dup | SDK retries idempotent verbs only; create/publish/schedule = no retry, no key | **HIGH** — a network blip after server-commit dups or orphans |
| Lifecycle (Buffer/Typefully) | schedule ⇄ unschedule ⇄ reschedule all first-class | create/schedule/reschedule yes; **no unschedule** despite backend `{cancel:true}` | **MED** — one flag away |
| Validation (clig.dev) | fail fast, before any network/side-effect | media ext/size checks run mid-upload loop after the selector network call | **MED** — half-uploaded state on bad input |
| Many-account UX | searchable picker, "all", saved default | picker works; no `=all`, no saved default, no filter on 23-item list | **MED** |
| Errors (clig.dev) | empathetic, actionable, next-step | mostly good (selector lists valid accounts) | LOW |
| Config (aws/gh/kubectl) | named profiles / default context | `--brand` every call, no default | NICE |

## Tiered, ranked suggestions

### MUST-HAVE (correctness + safety; the gaps the new features opened)

**M1 — Idempotency keys for create/publish/schedule.** `confidence: HIGH · effort: M`
The #38 retry/backoff work only covers idempotent verbs, so the highest-stakes
calls (the mutations) are exactly the ones with no safety net. World-class fix
(stripe model): CLI generates a UUID per mutation, sends `Idempotency-Key`; on a
network error the SDK *can* now safely retry the POST and the server dedups.
Closes the same orphan/dup risk class as #38's DELETE warning, at the source.
*Needs backend confirm: does the API honor an idempotency header?* → DECISION NEEDED.

**M2 — Pipe-aware output + `--jq`.** `confidence: HIGH · effort: S–M`
Make the default behave like gh: when `stdout` is not a TTY, emit JSON/TSV
regardless of `--format`; keep tables only for real terminals. Add a built-in
`--jq <expr>` filter so `ap posts list --jq '.[].id'` works with no `jq`
dependency. Same TTY-detection discipline that fixed the picker hang this
session — apply it to output too. Table-stakes for CI/scripting ICP.

**M3 — `posts schedule --cancel` (unschedule).** `confidence: HIGH · effort: S`
Backend already accepts `{cancel:true}`; pure CLI surfacing. Completes the
schedule→reschedule→unschedule loop. Make `--at` and `--cancel` mutually
exclusive; `--cancel` returns the post to draft.

**M4 — Fail-fast media validation.** `confidence: HIGH · effort: S`
Move ext→MIME, size (≤20MB), count (≤10), and alt-text-alignment checks into the
pure pre-network validation pass (before the auth-status call + spinner). No
network, no spinner, no partial upload on a typo'd extension. Already have the
validators — just reorder.

**M5 — Large-account-list ergonomics.** `confidence: MED · effort: M`
For the 23-LinkedIn reality: (a) `--account linkedin=all` / `p=*` to target every
connected account of a platform; (b) type-to-filter in the interactive picker;
(c) `ap brands set-default-account <brand> <p=handle>` persisted to config so a
2-account brand stops re-prompting. (a)+(c) are the high-value, low-cost pair.

### NICE-TO-HAVE (v0.3.4+)

- **N1 — Config profiles / default context** (`ap config set-context --brand … --account …`), aws/gh-style, so `--brand` isn't on every call. `MED`
- **N2 — `--dry-run` / `--preview` for create** — render the exact request body (resolved accounts, media, per-platform text) and exit 0 without writing. `S–M`
- **N3 — Bulk create/schedule from CSV/JSON** (`posts create --from posts.csv`) — the one feature every scheduler ICP expects; maps to N+1 create calls + a summary table. `M–L`

### MOONSHOT (needs backend work)

- **X1 — Queue slots** (`--at next` → next free slot per brand calendar) — Buffer's core. `L`
- **X2 — Recurring / evergreen templates** (cron-like reposting) — Typefully/Hypefury. `L`

## Recommended v0.3.3 scope

v0.3.3 currently = #31 (media) + #35 (selector), code-complete + 110-story green.
Smallest high-value additions that finish those features rather than expand scope:
**M3 (unschedule)** and **M4 (fail-fast media)** are S-effort and directly complete
the lifecycle/validation story already shipping. **M2** is the biggest
world-class lift but is its own change. **M1** is the most important safety fix
but is gated on a backend header confirm.

→ **Ship v0.3.3 as-is (#31+#35) + fold in M3 + M4.** File M1, M2, M5 as the
v0.3.4 "world-class" batch; N/X as backlog.

## Open questions / DECISION NEEDED

1. **M1:** does the backend honor an `Idempotency-Key` header (or a client-supplied
   request id) on create/publish/schedule? If not, M1 becomes a backend ticket first.
2. **Scope:** fold M3+M4 into v0.3.3, or keep v0.3.3 strictly #31+#35 and put
   everything in v0.3.4? (Recommend: fold M3+M4.)
3. **M2:** changing the piped-output default is technically a behavior change for
   anyone parsing today's table output in scripts — acceptable for a 0.x minor, or
   gate behind `--format auto` first? (Recommend: make `auto` the default; it's 0.x.)
