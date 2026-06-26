---
title: "PRD — M1: Idempotency keys for create / publish / schedule"
status: proposed
severity: HIGH
effort: M
confidence: HIGH (codebase-verified)
batch: v0.3.4 "world-class"
depends_on: backend (Autoposting-ai/autoposting-front-back)
created: 2026-06-26
---

> Auto-generated from research findings. DECISION NEEDED + LOW-confidence items require human judgment.

# M1 — Idempotency keys for mutations

## Problem statement

The #38 retry/backoff work made the SDK retry only idempotent verbs. From
`packages/sdk/src/client.ts`:

- Line 42: `IDEMPOTENT_METHODS = new Set(['GET','PUT','DELETE'])` — POST/PATCH excluded.
- Line 146–151: `isRetryable()` returns `false` for any non-idempotent method.
- Line 120 comment: *"Non-idempotent methods (POST/PATCH) are never retried, to avoid duplicate side effects."*

So the highest-stakes calls — the mutations — are exactly the ones with **no
safety net**. `PostsResource` (`packages/sdk/src/resources/posts.ts`):

- `create()` → `POST /posts` (line 27–29)
- `publish()` → `POST /posts/:id/publish` (line 40–42)
- `schedule()` → `PUT /posts/:id/schedule` (line 44–46) — PUT, so today it *is*
  auto-retried, which makes it the most dangerous: a server-commit followed by a
  dropped response triggers a blind retry with **no dedup on the backend**.

A network blip after the server commits the write therefore either (a) orphans
(create succeeded, client saw an error, user retries → duplicate post) or (b)
silently double-applies (schedule PUT retried). This is the same orphan/dup risk
class the improvement plan flags as `confidence: HIGH · effort: M` and ranks as
the #1 safety gap.

### Verified backend reality (this session) — the blocker

The backend has **no HTTP-level idempotency** on these endpoints:

- `create-post.step.ts:52` calls `Post.create(...)` directly, no dedup.
- publish / schedule steps use `findOneAndUpdate` but **read no
  `Idempotency-Key` / `x-idempotency-key` / `clientId` / `requestId`** header or
  body field.
- The `Post` model has **no unique constraint** on any client-supplied field that
  could enforce dedup at the DB layer.
- There **is** an internal `lib/idempotency.ts` (`buildIdempotencyKey(postId,
  platform)`, 24h TTL via Motia `stateManager`) — but it is used **only** for the
  per-platform publishing steps, **not** for client HTTP requests.

**Consequence:** sending an `Idempotency-Key` header from the CLI/SDK today is a
no-op — the server ignores it and still double-writes. **M1 cannot land
client-only.** It is gated on a backend change that reads the header and dedups.

## User stories

ICP: developers / technical marketers / agencies automating multi-account,
multi-platform posting from a terminal or CI.

- As a CI pipeline author, when my `ap posts create` step times out, I want to
  re-run the step and trust that I get **one** post, not two, so a flaky network
  never spams a brand's followers.
- As an agency operator scripting 200 scheduled posts in a loop, I want each
  call to carry a stable key so a mid-loop retry resumes safely instead of
  duplicating the half that already committed.
- As an SDK consumer, I want `posts.create()` to be safely retryable on
  transient 5xx/network errors the same way GET already is, without writing my
  own dedup bookkeeping.

## Requirements (MoSCoW)

### Functional

- **MUST** — Backend (front-back) reads an `Idempotency-Key` request header on
  `POST /posts`, `POST /posts/:id/publish`, `PUT /posts/:id/schedule`; on a
  repeat key within a TTL window it returns the **original** result (same post
  id / same response) instead of performing the write again.
- **MUST** — SDK generates one key per logical mutation (`crypto.randomUUID()`)
  and sends it as `Idempotency-Key` on those three calls.
- **MUST** — once the backend honors the key, allow safe retry of the keyed
  mutation on transient failures (network error, timeout, 5xx) — the dedup makes
  the retry safe.
- **SHOULD** — key is stable across the SDK's internal retry loop for a single
  logical call (generate once in the resource method, reuse across attempts), so
  the auto-retry and a dedup hit line up.
- **SHOULD** — CLI surfaces `--idempotency-key <uuid>` (and/or honors
  `AUTOPOSTING_IDEMPOTENCY_KEY`) so a CI step that itself retries the whole
  process can pin the key across process restarts (the only way to dedup across
  separate invocations).
- **COULD** — backend returns a header (e.g. `Idempotency-Replayed: true`) so the
  CLI can tell the user "this was a replay, not a new post."
- **WON'T** (this batch) — client-side persistent key cache / local dedup ledger;
  cross-endpoint keys; idempotency for non-post mutations (agents, kb, etc.).

### Non-functional

- **MUST** — no behavior change until the backend ships; the header is inert and
  harmless if the server ignores it, so the SDK half can ship first **only if**
  POST retry stays gated behind a capability flag (see Risks) — otherwise SDK
  POST retry would dup against the un-upgraded server.
- **MUST** — key format is a v4 UUID (or equivalent ≥128-bit random); no PII.
- **SHOULD** — TTL on the backend ≥ 24h to match the existing
  `lib/idempotency.ts` window and cover realistic CI retry horizons.

## Acceptance criteria

1. Backend integration test: two `POST /posts` with the **same**
   `Idempotency-Key` and identical body → exactly **one** `Post` document; second
   response equals the first (same `id`).
2. Backend test: same key, **different** body → defined behavior (recommend:
   `409`/`422` "key reused with different payload"), never a silent second write.
3. Backend test: same key on `publish` / `schedule` → single state transition.
4. SDK unit test: `posts.create()` sends an `Idempotency-Key` header that is a
   valid UUID; the **same** header value is sent on each internal retry attempt
   for one logical call.
5. SDK test: with the capability enabled, a `create()` that hits a simulated 503
   then 200 resolves once and the server (mock) sees the same key twice.
6. CLI test: `ap posts create --idempotency-key <uuid> …` forwards that exact
   value; absent the flag, a fresh UUID is generated per invocation.

## Technical approach (suggested starting points)

> Reuse what exists; do not add a dependency for a UUID — Node's
> `crypto.randomUUID()` covers it.

- **SDK header injection** — `packages/sdk/src/client.ts` `_send()` builds the
  header map at line 175–183. Plumb an optional per-call key down from
  `request()` (line 122) → `_send()` and set `headers['idempotency-key'] = key`
  when present. Mirror the existing "caller headers first, auth wins" ordering.
- **Key generation site** — generate in the `PostsResource` methods
  (`packages/sdk/src/resources/posts.ts` `create`/`publish`/`schedule`) so one
  key spans the whole `request()` retry loop. Pass it through as a new optional
  arg or an options object rather than re-deriving it inside the loop.
- **Safe POST retry** — `IDEMPOTENT_METHODS` (line 42) and `isRetryable()` (line
  146) are the exact gates. The lazy change: keep the set as-is and add "OR the
  request carries an idempotency key AND the server advertises support" to
  `isRetryable()`, rather than blanket-allowing POST retry. A capability gate (env
  flag or a one-time `GET /health`/profile probe) prevents dup'ing against an
  un-upgraded backend.
- **CLI flag** — add `--idempotency-key` to the relevant subcommands in
  `packages/cli/src/commands/posts.ts` (create/publish/schedule actions), default
  to `crypto.randomUUID()`, forward into the SDK call.
- **Backend** (front-back, separate PR — the gating work) — read the header in
  the create/publish/schedule steps; store key→result with a TTL using the same
  Motia `stateManager` pattern already in `lib/idempotency.ts`
  (`buildIdempotencyKey` is the existing precedent to generalize to a
  client-supplied key); short-circuit a repeat key to the stored result. A DB
  unique index on `(orgId, idempotencyKey)` is the durable backstop if the state
  cache misses.

## Risks + confidence

- **Confidence: HIGH** that the gap is real — verified directly in
  `client.ts` (POST excluded from retry) and in the backend steps this session
  (no header read, no unique constraint). Primary evidence = codebase.
- **Risk #1 (the big one): ordering dependency.** Shipping SDK POST retry before
  the backend dedups would *cause* the very duplication M1 prevents. The SDK half
  is only safe behind a capability gate, or shipped strictly after the backend.
- **Risk: schedule is PUT** and is already auto-retried today against a
  non-dedup'ing backend — so M1 also *closes an existing live dup risk*, it isn't
  purely additive. Worth calling out: arguably a small backend dedup is needed
  regardless of the rest of M1.
- **Risk: "same key, different body"** semantics are a backend product decision
  (reject vs. ignore-and-replay-original). Stripe rejects; recommend matching.
- Secondary evidence (external bar): Stripe's idempotency-key model on every POST
  is the reference design (web research).

## DECISION NEEDED

1. **Backend ownership + sequencing.** M1 is **blocked** on a front-back change
   that reads `Idempotency-Key` and dedups. Confirm: does the team accept M1 as a
   backend ticket *first*, then CLI/SDK? (Primary recommendation: yes — file the
   backend ticket as a hard dependency; the CLI/SDK half is a fast follow.)
2. **Header name.** `Idempotency-Key` (Stripe/IETF draft convention) vs. a
   custom `x-idempotency-key` / `x-request-id`. Pick one and use it on both ends.
3. **Capability gate vs. hard sequencing.** Do we gate SDK POST retry behind a
   server-capability probe (ships independently, self-protects) or simply forbid
   the SDK retry change until the backend is confirmed live (simpler, no probe)?
4. **"Same key, different payload"** response: `409`/`422` reject vs. replay the
   original. Recommend reject (catches client bugs).

## Open questions

- Does the existing `lib/idempotency.ts` `stateManager` TTL store scale to
  client-request volume, or is a dedicated collection + unique index the better
  durable home for client keys?
- Should `retry` / `rewrite` / `score` (other POSTs in `posts.ts`) also carry
  keys, or are they naturally idempotent / low-stakes enough to defer? (Recommend
  defer — out of this batch.)
- Cross-invocation dedup: is `--idempotency-key` / env-pin enough for CI, or do
  ICPs expect the CLI to persist a key ledger? (Recommend flag-only for v0.3.4.)
