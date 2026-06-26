---
"@autoposting.ai/sdk": patch
"@autoposting.ai/cli": patch
---

Bug-squash batch (v0.3.2):

- **Reject a past `--at`** on `posts create`/`schedule`/`update` before any request — a past schedule time would publish immediately. (#32)
- **SDK retries transient failures** (network/timeout/5xx) for idempotent requests (GET/PUT/DELETE) with exponential backoff + jitter; POST/PATCH are never retried, to avoid duplicate side effects. `maxRetries`/`retryBaseMs` are configurable. (#38)
- **`posts delete` warns** when a delete fails after retries, so a still-scheduled post isn't silently orphaned. (#38)
- **`workspaces list` under API-key auth** now fails fast with actionable guidance (`/orgs` is session-only) instead of a bare "Unauthorized". (#39)
- **`brands auth-status`** reads the real backend fields: the USERNAME column maps `platformUsername` (was always blank), token status is classified from `expiresAt`/`refreshError` (an expired/refresh-failed token no longer reads "ok"), and a new EXPIRES column shows the expiry. (#33, #34)
- **`whoami` resolves the server-side identity** (org + auth type) via `GET /auth/profile`, instead of only confirming the key is accepted. (#36)
- **Spinner shows ✖ on failure**, not a false ✔ — command catch paths now mark the spinner failed. (#37)
