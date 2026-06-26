---
"@autoposting.ai/sdk": patch
"@autoposting.ai/cli": patch
---

Fix broken endpoint paths, unwrap the API response envelope, harden the HTTP client and auth flows, and validate command inputs.

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
