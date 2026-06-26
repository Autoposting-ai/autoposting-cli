---
title: "PRD — M2: Pipe-aware output + built-in --jq"
status: proposed
severity: HIGH
effort: S–M
confidence: HIGH (codebase-verified)
batch: v0.3.4 "world-class"
created: 2026-06-26
---

> Auto-generated from research findings. DECISION NEEDED + LOW-confidence items require human judgment.

# M2 — Pipe-aware output + `--jq`

## Problem statement

World-class CLIs (gh, and the clig.dev guideline "human-first, but machine-
readable when not a TTY") auto-switch to machine-readable output when `stdout`
is not a terminal. autoposting-cli does the opposite by accident.

The default is a TTY table — `packages/cli/src/cli.ts:30`:

```
.option('--format <type>', 'Output format: table, json', 'table')
```

And `detectOutputMode` in `packages/cli/src/output/formatter.ts:25–33` checks the
explicit format **before** the TTY check:

```
if (options.format === 'json' || options.json) return 'json'
if (options.format === 'table') return 'tty'      // ← fires for the DEFAULT
if (!process.stdout.isTTY) return 'json'           // ← never reached when default
return 'tty'
```

Because the default `format` is literally `'table'`, line 31 returns `'tty'` and
the `!isTTY` fallback on line 32 is **dead for the common case**. Result:
`ap posts list | grep …` renders an aligned ANSI table into the pipe — a
scripting footgun. This is the **same TTY-detection class** as the interactive
picker-hang bug fixed this session (`account-select.ts` gates the inquirer
prompt on `isTty`): the tool assumes a human when it should detect one.

There is also no built-in field extractor, so users reach for an external `jq`
just to pull an id: `ap posts list --json | jq '.[].id'`.

The improvement plan ranks this `confidence: HIGH · effort: S–M` and calls it
"Table-stakes for CI/scripting ICP" — the biggest single world-class lift.

## User stories

ICP: developers / technical marketers / agencies automating from a terminal/CI.

- As a CI author, when I run `ap posts list` and pipe it, I want JSON **by
  default** so my `grep`/`awk`/`jq` parses clean data, not a rendered table —
  without having to remember `--json` on every call.
- As a developer at an interactive shell, I still want the pretty table when I
  run the same command by hand — the tool should tell the difference.
- As a scripter, I want `ap posts list --jq '.[].id'` to print just the ids with
  **no `jq` binary installed**, so my pipeline has one fewer dependency.
- As an automation owner, I want a stable, documented contract for "what comes
  out when piped" so I can rely on it across versions.

## Requirements (MoSCoW)

### Functional

- **MUST** — when `stdout` is not a TTY and the user gave no explicit format,
  emit machine-readable output (JSON), regardless of the `'table'` default.
- **MUST** — when `stdout` is a TTY and no explicit format, keep the human table.
- **MUST** — explicit `--format table` / `--json` / `--format json` / `--quiet`
  still win over auto-detection (user intent is honored, even into a pipe).
- **MUST** — introduce `auto` as the effective default behavior (detect by TTY),
  whether implemented as a new `'auto'` value or by dropping the hard `'table'`
  default so the existing `!isTTY` branch becomes reachable.
- **SHOULD** — add `--jq <expr>` that applies a filter to the JSON result and
  prints the filtered output; works without an external `jq`.
- **SHOULD** — `--jq` implies JSON semantics for input and exits non-zero on an
  expression error with a clear message.
- **COULD** — `--format tsv` for tabular machine output (one row per line,
  tab-separated) for `cut`/`awk` users.
- **COULD** — respect `NO_COLOR` / non-TTY to also strip ANSI (already partly
  handled: `formatter.ts:12` `red()` no-ops when `!process.stdout.isTTY`).
- **WON'T** (this batch) — a full jq language reimplementation; ship a minimal
  path/filter subset (see approach) or a tiny vetted dependency.

### Non-functional

- **MUST** — zero new behavior for explicit-flag users; only the *default-into-a-
  pipe* case changes.
- **SHOULD** — `--jq` adds no heavyweight dependency; prefer a tiny, audited lib
  or a minimal built-in expression evaluator over pulling a large parser.
- **SHOULD** — output contract documented in `--help` and README so scripts can
  depend on it.

## Acceptance criteria

1. `detectOutputMode` unit test: `format` unset (or `'auto'`) + `isTTY=false` →
   `'json'`; same + `isTTY=true` → `'tty'`.
2. `--format table` + `isTTY=false` → still `'tty'` (explicit override honored).
3. `--json` and `--quiet` behavior unchanged (regression-guard the existing
   `formatter.test.ts`).
4. Integration: `ap posts list` piped (non-TTY) prints valid `JSON.parse`-able
   output; run in a TTY prints the aligned table.
5. `ap posts list --jq '.[].id'` prints one id per line and exits 0; a bad
   expression exits non-zero with a readable error and no stack trace.
6. No external `jq` on PATH is required for criterion 5 to pass.

## Technical approach (suggested starting points)

> The fix is mostly reordering + a default change — the laziest correct version
> is a few lines in two files.

- **Core toggle** — `packages/cli/src/output/formatter.ts` `detectOutputMode`
  (line 25). Make the TTY check authoritative when no explicit format was given.
  Either:
  - drop the `'table'` default in `cli.ts:30` so `options.format` is `undefined`
    by default and the existing `if (!process.stdout.isTTY) return 'json'` (line
    32) finally runs; **or**
  - add an explicit `'auto'` value to `OutputOptions.format` (line 16–23) and
    make `auto` resolve via `process.stdout.isTTY`.
  Keep the explicit `'json'`/`'table'`/`quiet` branches above it untouched so
  user overrides still win.
- **Default flag** — `packages/cli/src/cli.ts:30`: change the description/default
  to `auto, table, json` with default `auto` (or no default). This is the one
  line that flips the footgun.
- **Threading** — commands read globals via `cmd.optsWithGlobals<GlobalOpts>()`
  (e.g. `posts.ts:97`) and print through `createPrinter(globals)`
  (`output/printer.ts`). The printer already calls `detectOutputMode`, so fixing
  the detector propagates everywhere; verify `printer.ts` passes `format`
  through rather than assuming a table.
- **`--jq`** — add a global option in `cli.ts` alongside `--json`. In the printer,
  when `--jq` is set, serialize the result to a JS value and apply the filter
  before output. Lazy ladder: a minimal dot/bracket/`[]`-iterator evaluator
  covers the `.[].id` / `.field` / `.a.b` cases the ICP actually pipes; only
  reach for a dependency if the expression surface needs to be real jq. Mark the
  ceiling with a `ponytail:` comment if shipping the minimal subset.
- **TSV (COULD)** — `formatTable` (`formatter.ts:43`) already computes columns;
  a TSV emitter is a sibling function reusing the same column derivation.

## Risks + confidence

- **Confidence: HIGH** — gap verified directly in `cli.ts:30` (default `'table'`)
  and `formatter.ts:31` (table-before-TTY ordering). Primary evidence = codebase.
- **Risk: behavior change for existing scripts** parsing today's *table* output
  out of a pipe. For a 0.x minor this is acceptable, but it is a real contract
  change — anyone who built a fragile `awk` over the table columns breaks (and
  arguably should). The improvement plan's open question #3 flags exactly this.
- **Risk: `--jq` scope creep.** A from-scratch jq is a trap (the ladder says stop
  early). Minimal subset or a tiny lib; do not build a parser.
- **Low risk: color.** `red()` already guards on `isTTY`; confirm no other ANSI
  leaks into piped output once default flips.
- Secondary evidence: gh's auto-switch + `--jq`, clig.dev "machine-readable when
  not a TTY" (web research).

## DECISION NEEDED

1. **Default flip vs. opt-in.** Make `auto` the **default** now (recommended —
   it's 0.x, and matches gh/clig.dev), or ship `--format auto` as opt-in for one
   minor and flip the default in v0.4.0? The improvement plan recommends flipping
   now.
2. **`--jq` implementation.** Minimal built-in subset (zero deps, covers common
   paths) vs. a small vetted jq-like dependency (full expressions, +1 dep). Lazy
   recommendation: minimal subset, document the ceiling.
3. **TSV in scope** for v0.3.4 or deferred? (Recommend defer; JSON + `--jq`
   satisfies the ICP.)

## Open questions

- Should `--json` be kept as an alias once `auto`/`--format json` exist, for
  backward compat? (Recommend: yes, keep `--json` as a documented alias.)
- Does any command bypass `createPrinter`/`detectOutputMode` and print tables
  directly? Audit before flipping the default so nothing leaks a table into a
  pipe. (`printer.ts` + each command's `.action` are the audit surface.)
- Should errors also go to stdout-as-JSON when piped, or stay on stderr?
  (`formatError` at `formatter.ts:71` already returns JSON for non-tty modes;
  confirm stream routing.)
