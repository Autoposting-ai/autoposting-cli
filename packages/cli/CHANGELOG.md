# autoposting-cli

## 0.3.4

### Patch Changes

- CLI v0.3.4 — output ergonomics, fan-out safety, brand context, dry-run, and bulk create.
  - **Auto output mode**: default output adapts to the destination — a human-readable table on an interactive terminal, JSON when piped or non-interactive — so scripts get machine output without a flag. `--format table`, `--json`, and `--quiet` still force a mode. Added a built-in `--jq <expr>` filter (zero-dependency minimal subset) for shaping JSON without piping to `jq`.
  - **Fan-out & saved targets**: `--account <p>=all` (or `=*`) targets every connected account of a platform and always prints the resolved account count; an explicit large fan-out asks for confirmation on a TTY. Save per-brand defaults with `ap brands set-default-account <slug> <p=handle|all...>` (plus `get-default-account`/`clear-default-account`), applied when `--account` is omitted. The multi-account picker pages for long lists.
  - **Brand context**: `ap config set-context --brand <slug>` (plus `get-context`/`unset-context`) stores a default brand so `--brand` can be omitted on `posts` commands.
  - **Dry run**: `posts create --dry-run` (alias `--preview`) prints the resolved request body without uploading media or creating the post; fail-fast validation still runs.
  - **Bulk create**: `posts create --from <file>` creates one post per row from a JSON array or a CSV. Each row is independent — a per-record summary is printed and the command exits non-zero if any row failed.
  - @autoposting.ai/sdk@0.3.4

## 0.3.3

### Patch Changes

- posts create: media attachments + platform-specific options, and a per-account selector
  - `posts create` now uploads media and attaches it: `--media <files...>`, `--platform-media <p=path...>`, `--alt-text <text...>`, plus `--platform-text <p=text...>` and per-platform option flags (`--yt-*`, `--ig-*`, `--threads-*`). Unsupported file extensions are rejected before any upload.
  - Per-account targeting when a brand has multiple connected accounts of the same platform: `--account <p=handle|id...>` (handles are case-insensitive, leading `@` optional). With 2+ accounts and no flag, an interactive picker runs on a real TTY; non-interactive contexts fail fast with the list of valid accounts.
  - `posts schedule <id> --cancel` unschedules a post (returns it to draft). `--at` is now optional; provide exactly one of `--at` or `--cancel`.

- Updated dependencies
  - @autoposting.ai/sdk@0.3.3

## 0.3.2

### Patch Changes

- 759f9ee: Bug-squash batch (v0.3.2):
  - **Reject a past `--at`** on `posts create`/`schedule`/`update` before any request — a past schedule time would publish immediately. (#32)
  - **SDK retries transient failures** (network/timeout/5xx) for idempotent requests (GET/PUT/DELETE) with exponential backoff + jitter; POST/PATCH are never retried, to avoid duplicate side effects. `maxRetries`/`retryBaseMs` are configurable. (#38)
  - **`posts delete` warns** when a delete fails after retries, so a still-scheduled post isn't silently orphaned. (#38)
  - **`workspaces list` under API-key auth** now fails fast with actionable guidance (`/orgs` is session-only) instead of a bare "Unauthorized". (#39)
  - **`brands auth-status`** reads the real backend fields: the USERNAME column maps `platformUsername` (was always blank), token status is classified from `expiresAt`/`refreshError` (an expired/refresh-failed token no longer reads "ok"), and a new EXPIRES column shows the expiry. (#33, #34)
  - **`whoami` resolves the server-side identity** (org + auth type) via `GET /auth/profile`, instead of only confirming the key is accepted. (#36)
  - **Spinner shows ✖ on failure**, not a false ✔ — command catch paths now mark the spinner failed. (#37)

- Updated dependencies [759f9ee]
  - @autoposting.ai/sdk@0.3.2

## 0.3.1

### Patch Changes

- a6cecee: Fix broken endpoint paths, unwrap the API response envelope, harden the HTTP client and auth flows, and validate command inputs.

  **SDK response envelope (systemic fix):**
  - The backend wraps every success as `{ success: true, data: <payload> }`; the SDK now unwraps it in `client.request()` and returns the inner payload (void deletes → `{}`; non-enveloped bodies pass through). Previously the raw envelope leaked out, so every resource return type was wrong at runtime.
  - All resource return types and CLI/MCP consumers realigned to the real data shapes: bare arrays, `Paginated{ items, total, limit, offset }`, `{ results }`, `{ clips, pagination }` — replacing the fictional `{ data, page, hasMore }` shape.
  - `ideas enrich` now takes `--title/--hook/--angle/--platforms` (the backend enriches an idea object across 1–5 platforms; there is no enrich-by-id route).

  **SDK endpoint corrections** (now match the unversioned backend routes):
  - `workspaces.switch` → `PUT /orgs/active`
  - `ideas.generate` → `POST /ideas/generate-topic`
  - `clips.importUrl` → `POST /clips/import-url`
  - `posts.*` no longer send a bogus `/v1` prefix

  **SDK client hardening:**
  - Base URL resolves with `||` so an empty `NEXT_PUBLIC_API_URL` still falls through to `/api-proxy`; honors `AUTOPOSTING_BASE_URL`.
  - Per-request timeout via `AbortController` with a guaranteed cleanup; fetch failures surface as typed `TIMEOUT` / `NETWORK_ERROR` errors instead of raw rejections.
  - `Retry-After` parsed as either seconds or an HTTP date.
  - Always sends `x-source: sdk`; omits `content-type` for `FormData` uploads so the boundary is set correctly.

  **CLI hardening:**
  - `whoami` now validates the key against the server and reports validity. It degrades to "unverified" (exit 0) when the server is unreachable and only exits non-zero when the key is rejected.
  - Exit codes attached to errors are honored consistently across every command.
  - Credential store: respects `XDG_CONFIG_HOME`, writes atomically (temp + rename) with `0600` permissions, and recovers from a corrupt credentials file.
  - Device-code login: request timeouts and guarded JSON parsing with clear errors.
  - `posts`: validates platforms, status, positive integers, and ISO `--at` timestamps; adds a `--thread` flag for multi-tweet threads.
  - `doctor` reports the honest "credentials configured" (local presence) rather than overclaiming "authenticated".

- Updated dependencies [a6cecee]
  - @autoposting.ai/sdk@0.3.1

## 0.3.0

### Minor Changes

- Harden the v0.3 CLI and MCP release path with stricter platform validation, correct package metadata, packed package smoke checks, and audit/typecheck release gates.

### Patch Changes

- Updated dependencies
  - @autoposting.ai/sdk@0.3.0

## 0.2.0

### Minor Changes

- Initial release of Autoposting CLI and SDK.

  SDK: TypeScript client for the Autoposting.ai API with resources for posts, brands, agents, KB, ideas, clips, carousels, webhooks, billing, usage, and workspaces.

  CLI: 61 commands across 13 domains, device code login, shell completions, MCP server with 51 tools, and doctor/whoami/open/update utilities.

### Patch Changes

- Updated dependencies
  - @autoposting.ai/sdk@0.2.0
