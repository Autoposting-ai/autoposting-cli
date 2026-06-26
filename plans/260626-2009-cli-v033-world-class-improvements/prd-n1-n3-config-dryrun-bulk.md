---
title: "PRD — N1/N2/N3: Config context, --dry-run, bulk create"
status: proposed
severity: NICE-TO-HAVE
effort: "N1 MED · N2 S–M · N3 M–L"
confidence: HIGH (codebase-verified mechanism)
batch: v0.3.4+ "world-class"
created: 2026-06-26
---

> Auto-generated from research findings. DECISION NEEDED + LOW-confidence items require human judgment.

# N1 / N2 / N3 — Config context · Dry-run · Bulk create

Three NICE-TO-HAVE items from the improvement plan, combined because they share a
config/preview/loop surface. Each is independently shippable.

---

## N1 — Config profiles / default context

### Problem statement

Every brand-scoped command repeats `--brand <slug>` (e.g.
`packages/cli/src/commands/posts.ts:92` `--brand <slug>` on `list`, and the
create/schedule actions). aws/gh/kubectl set a default context once
(`aws configure`, `gh repo set-default`, `kubectl config use-context`) so the
common case needs no repetition. autoposting-cli has **no config command and no
default context** — verified: a search for `config` under
`packages/cli/src/commands/` returns nothing; the only persisted state is auth
credentials. The improvement plan ranks this `MED`.

### User stories

- As an operator working one brand all day, I want `ap config set-context
  --brand udit-goenka` once, then run `ap posts list` with no `--brand`.
- As an agency juggling brands, I want to switch the active context in one command
  and have every subsequent call inherit it, while `--brand` still overrides per-call.

### Requirements (MoSCoW)

- **MUST** — `ap config set-context --brand <slug>` persists a default brand;
  brand-scoped commands use it when `--brand` is absent.
- **MUST** — explicit `--brand` overrides the saved context (per-call wins).
- **SHOULD** — `ap config get-context` / `ap config list` shows current context;
  `ap config unset-context` clears it.
- **SHOULD** — context can also carry a default account (composes with M5's
  per-brand default-account store — share one file).
- **COULD** — named profiles beyond the active credential profile (the
  credential store already has `activeProfile` + `profiles`).
- **WON'T** (this batch) — per-directory/project-local config files; env-var
  context overrides beyond what already exists.

### Acceptance criteria

1. `set-context --brand X` then `ap posts list` (no `--brand`) lists brand X.
2. `set-context --brand X` then `ap posts list --brand Y` lists brand Y (override).
3. `get-context` reflects the saved value; `unset-context` clears it.
4. No context set + no `--brand` → today's behavior unchanged (no regression).

### Technical approach (suggested starting points)

> Reuse the credential store — do **not** add a config library.

- **Storage** — `packages/cli/src/auth/credential-store.ts` already gives an
  atomic, 0600, XDG-located JSON store (`getCredentialsPath()` line 17–23;
  temp-write+rename line 36–62). Add a sibling `config.json` (or a `context` key)
  with the same helpers. This is the **same store M5's saved-default-account
  needs** — build it once, share it.
- **Resolution** — commands read `--brand` from action opts (e.g. `posts.ts`
  actions). Add a small `resolveBrand(opts)` helper: `opts.brand ?? savedContext`.
  Keep it one function so every command routes through the same precedence.
- **Command** — new `packages/cli/src/commands/config.ts`, registered in
  `cli.ts` alongside the others (line 38–55).

---

## N2 — `--dry-run` / `--preview` for create

### Problem statement

`ap posts create` resolves accounts, media, and per-platform text, then writes
immediately (`PostsResource.create` → `POST /posts`,
`packages/sdk/src/resources/posts.ts:27`). There is no way to see the **exact
request body** that would be sent before committing. clig.dev recommends a
dry-run for any destructive/irreversible action; a published post is exactly
that. The improvement plan ranks this `S–M`.

### User stories

- As a scripter building a complex multi-platform `create` with media and
  per-account targeting, I want `--dry-run` to print the resolved request body and
  exit 0 **without** creating, so I can verify before publishing.
- As a CI author, I want a dry-run mode I can run in a pre-merge check to validate
  that my post args resolve (accounts exist, media exists) without side effects.

### Requirements (MoSCoW)

- **MUST** — `--dry-run` (alias `--preview`) on `posts create` runs the full
  **local** resolution (platforms, `--account` → target ids, media path
  validation, per-platform text, platform options) and prints the request body
  that **would** be POSTed, then exits 0 with no write.
- **MUST** — dry-run performs no mutating call; read-only resolution calls (e.g.
  `authStatus` for account resolution) are allowed since they have no side effect.
- **SHOULD** — output respects M2 output mode (JSON when piped) so the body is
  machine-checkable.
- **COULD** — extend `--dry-run` to `publish`/`schedule` later.
- **WON'T** — server-side validation/preview (no backend dependency for v0.3.4).

### Acceptance criteria

1. `ap posts create --dry-run …` prints the resolved request body and makes **no**
   `POST /posts` call (assert the SDK mutation is never invoked).
2. Dry-run still runs fail-fast local validation: a bad media extension /
   nonexistent file / unknown account errors the same as a real run
   (`media-flags.ts` validators + `account-select.ts` resolution).
3. Exit code 0 on a valid dry-run; non-zero on a resolution error.
4. Piped dry-run output is valid JSON (composes with M2).

### Technical approach (suggested starting points)

- **Hook point** — `packages/cli/src/commands/posts.ts` create action: it already
  assembles `MediaInput`, calls `resolveTargetAccounts`
  (`lib/account-select.ts`), and builds platform options
  (`buildYoutubeOptions`/`buildInstagramOptions`/`buildThreadsOptions` in
  `lib/media-flags.ts`). Add `--dry-run`; after building the `CreatePostParams`
  object but **before** `client.posts.create(...)`, branch: print the params via
  the printer and return.
- **Reuse, don't duplicate** — the body assembled for the real call is the exact
  thing to print; do not build a separate "preview" shape.
- **Read-only allowance** — `resolveTargetAccounts` calls
  `client.brands.authStatus` (account-select.ts:52); that GET is fine in dry-run.

---

## N3 — Bulk create/schedule from CSV/JSON

### Problem statement

Every scheduler ICP (Buffer/Typefully/Hypefury) expects bulk import; the CLI has
only single-post `create`. The improvement plan ranks this `M–L` and calls it
"the one feature every scheduler ICP expects." Mechanically it maps to N+1
`create` calls plus a summary table.

### User stories

- As an agency, I want `ap posts create --from posts.csv` to create one post per
  row across brands/platforms, then print a per-row success/failure summary.
- As a content team, I want `--from posts.json` for richer per-post structure
  (media arrays, per-platform text, schedule times) that CSV can't express
  cleanly.
- As a CI author, I want a non-zero exit if **any** row fails, with a machine-
  readable summary of which rows succeeded so I can retry only the failures.

### Requirements (MoSCoW)

- **MUST** — `ap posts create --from <file>` reads a CSV or JSON file and creates
  one post per record.
- **MUST** — a per-record summary (row index/id, status, post id or error)
  printed at the end; respects M2 output mode.
- **MUST** — partial-failure semantics: continue past a failed row, collect
  errors, exit non-zero if any failed; summary identifies failures for retry.
- **SHOULD** — interplay with M1: each row's create carries its own idempotency
  key so a re-run of the bulk file (after fixing failures) doesn't dup the rows
  that already succeeded. (Hard dependency on M1's backend support for true
  cross-run dedup.)
- **SHOULD** — `--dry-run` (N2) composes: preview all rows' resolved bodies
  without writing.
- **COULD** — concurrency limit flag (`--concurrency N`) for large files.
- **COULD** — schedule column → calls `schedule` after create.
- **WON'T** (this batch) — CSV schema autodetection magic; templating/variable
  substitution across rows; queue-slot scheduling (that's moonshot X1).

### Acceptance criteria

1. `--from posts.csv` with N valid rows → N posts created; summary lists N
   successes; exit 0.
2. A file with one invalid row (bad platform/media) → other rows still created;
   summary marks the bad row failed; exit non-zero.
3. Summary is valid JSON when piped (M2).
4. JSON input supports media arrays + per-platform text that CSV flattening can't.
5. (If M1 shipped) re-running the same file after fixing one row does not
   duplicate the already-created rows.

### Technical approach (suggested starting points)

- **Loop, not a new engine** — N3 is a thin file reader + a loop over the existing
  `client.posts.create` (`packages/sdk/src/resources/posts.ts:27`). The single-
  post create action in `packages/cli/src/commands/posts.ts` already validates and
  assembles `CreatePostParams`; factor that assembly into a reusable function and
  call it per row. Lazy ladder: don't build a bulk abstraction — reuse the
  per-post path.
- **CSV parsing** — prefer a tiny, audited CSV parser or a minimal built-in for a
  flat schema; do not pull a heavy framework. JSON needs no dependency
  (`JSON.parse`). Mark the parser ceiling with a `ponytail:` comment.
- **Summary table** — `formatTable` (`output/formatter.ts:43`) already renders
  rows; the per-record result set feeds straight into it (and into JSON when
  piped via M2).
- **Idempotency per row** — if M1 lands, generate a key per row (stable if the
  file carries an explicit per-row id column) so bulk re-runs are safe.

---

## Cross-cutting risks + confidence

- **Confidence: HIGH** on mechanism for all three — verified the credential store
  (N1/M5 share it), the create action + SDK `create()` (N2/N3 hook there), and the
  formatter (summary + M2). Primary evidence = codebase.
- **N1 risk:** a hidden default-brand context can surprise a user who forgot it is
  set (wrong brand posted to). Mitigate: `get-context` visibility + always show
  the resolved brand in command output.
- **N2 risk:** "dry-run" must be genuinely side-effect-free — the only network
  calls allowed are GETs (authStatus). Audit the create path for any incidental
  write before the create call.
- **N3 risk (biggest):** partial-failure + re-run safety is only truly solved with
  M1. Without M1, a bulk re-run dups already-created rows. N3 is shippable without
  M1 but its re-run story is weak until M1 lands — call this out.
- **N3 risk:** CSV is lossy for media arrays / per-platform text; JSON is the
  honest format. Don't over-invest in CSV expressiveness.
- Secondary evidence: aws/gh/kubectl context, Buffer/Typefully/Hypefury bulk
  import, clig.dev dry-run guidance (web research).

## DECISION NEEDED

1. **N1 storage** — share **one** `config.json` with M5's default-account store
   (recommended) vs. separate files. Aligns with M5 DECISION #2.
2. **N3 sequencing vs. M1** — ship N3 now with weak re-run safety (documented),
   or hold N3 until M1's backend dedup lands so bulk re-runs are safe?
   (Recommend: ship N3, document the re-run caveat, harden once M1 lands.)
3. **N3 input formats** — CSV **and** JSON in v0.3.4, or JSON-only first (simpler,
   lossless) with CSV as a fast follow? (Recommend: JSON-first.)
4. **N2 scope** — `--dry-run` on `create` only, or also `publish`/`schedule` in
   the same PR? (Recommend: create only; extend later.)

## Open questions

- N1: should the default context also pin a default account (composing with M5),
  or only brand? (Recommend: brand first; account via M5's store.)
- N3: what is the CSV column contract (which columns map to platforms, media,
  schedule)? Needs a documented schema before build.
- N3: concurrency — sequential (simple, slow on large files) vs. bounded
  parallel? (Recommend: sequential for v0.3.4; `--concurrency` later.)
- N2: should dry-run output include the resolved target account ids/handles
  inline so the user sees the fan-out (esp. with M5's `=all`)? (Recommend: yes.)
