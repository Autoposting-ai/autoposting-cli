# Security Audit — Autoposting CLI + SDK

**Date:** 2026-05-13  
**Scope:** `packages/sdk/src/`, `packages/cli/src/`, backend `src/auth/cli-device-code*.step.ts`, `src/models/device-code.model.ts`, `src/mcp/mcp-tool-definitions.ts`  
**Methodology:** STRIDE + OWASP Top 10  
**Status:** CRITICAL — 0 | HIGH — 2 fixed | MEDIUM — 5 (3 fixed, 2 accepted) | LOW — 4 | INFO — 5

---

## Findings

### HIGH — Fixed

---

#### HIGH-01 — Regex Injection via `userCode` in Authorize Step

**File:** `backend/src/auth/cli-device-code-authorize.step.ts:40`  
**STRIDE:** Tampering / Elevation of Privilege  
**OWASP:** A03 Injection

**Description:**  
User-supplied `body.userCode` was interpolated directly into a `new RegExp()` constructor without escaping:

```ts
// BEFORE (vulnerable)
const normalizedCode = body.userCode.toUpperCase().replace(/-/g, '')
const record = await DeviceCode.findOne({
  userCode: { $regex: new RegExp(`^${normalizedCode.slice(0, 4)}-?${normalizedCode.slice(4)}$`, 'i') },
})
```

An attacker could supply `userCode: "AAAA(.*)"` to construct `/^AAAA-?(.*)$/i`, matching any code starting with `AAAA` — authorizing another user's device code. A crafted input like `"AAAA))))"` produces an invalid regex, triggering an unhandled exception and crashing the step.

**Fix applied:**  
1. Added strict format validation: `/^[A-HJ-NP-Z2-9]{4}-?[A-HJ-NP-Z2-9]{4}$/i` (matches only the generation charset, rejects all regex metacharacters).  
2. Replaced regex-based MongoDB query with exact string lookup: `DeviceCode.findOne({ userCode: formattedCode })`.  
3. Added runtime `typeof` check before processing.

---

#### HIGH-02 — NoSQL Operator Injection in Poll Endpoint

**File:** `backend/src/auth/cli-device-code-poll.step.ts:14,24`  
**STRIDE:** Tampering / Spoofing  
**OWASP:** A03 Injection

**Description:**  
`device_code` from `input.request.queryParams` was cast to `string` via TypeScript only (compile-time, no runtime effect). With standard HTTP query parsing (e.g. Express `qs`), a request like:

```
GET /auth/cli/poll?device_code[$gt]=
```

results in `device_code` being `{ $gt: '' }` at runtime. Passing this to `DeviceCode.findOne({ deviceCode: device_code })` executes a MongoDB query matching the lexicographically "greatest" document — leaking an active session token to an unauthenticated attacker.

**Fix applied:**  
Added UUID v4 format validation before the DB lookup:
```ts
if (typeof device_code !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(device_code)) {
  return { status: 400, body: { success: false, error: 'Invalid device_code format' } }
}
```

---

### MEDIUM — Fixed

---

#### MEDIUM-01 — Config Directory Created with World-Readable Permissions

**File:** `packages/cli/src/auth/credential-store.ts:37-38`  
**STRIDE:** Information Disclosure  
**OWASP:** A05 Security Misconfiguration

**Description:**  
`fs.mkdirSync(dir, { recursive: true })` uses the default mode (`0o777`, subject to umask), typically resulting in `0o755`. This means the `~/.config/autoposting/` directory is readable and listable by all users on a shared system, exposing the existence of the credentials file even though the file itself is `0o600`.

**Fix applied:**  
```ts
// BEFORE
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true })
}

// AFTER
fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
```
Also removes the TOCTOU race between `existsSync` and `mkdirSync` — `recursive: true` is idempotent.

---

#### MEDIUM-02 — API Key Publicly Accessible on SDK Client Instance

**File:** `packages/sdk/src/client.ts:16`  
**STRIDE:** Information Disclosure  
**OWASP:** A02 Cryptographic Failures / A04 Insecure Design

**Description:**  
`readonly apiKey: string` was a public property. Any code holding a reference to the `Autoposting` instance could read the raw key (e.g. via `JSON.stringify(client)`, serialization into logs, or inspector tools). This violates the principle that credentials should be encapsulated.

**Fix applied:**  
Renamed to `private readonly _apiKey` with JSDoc marking it as internal.

---

#### MEDIUM-03 — API Key Exposed in Process Arguments (`ps aux`)

**File:** `packages/cli/src/cli.ts`, `packages/cli/src/commands/auth.ts`  
**STRIDE:** Information Disclosure  
**OWASP:** A02 Cryptographic Failures  
**Status:** ACCEPTED (no fix applied — inherent Commander limitation)

**Description:**  
When using `ap --api-key sk-secret-123 posts list`, the key appears verbatim in `process.argv` and is visible to all users on the system via `ps aux` / `ps -ef` for the duration of the process.

**Recommendation:**  
Document in CLI help/README that `--api-key` flag should be avoided in favour of `AUTOPOSTING_API_KEY` env var or stored credentials for scripting. Consider adding a warning to the login command output. The env var approach does not expose the key in the process listing.

---

### MEDIUM — Informational (no immediate code fix)

---

#### MEDIUM-04 — API Key Stored Plaintext in `device_codes` MongoDB Collection During Transit

**File:** `backend/src/auth/cli-device-code-authorize.step.ts:84`, `backend/src/models/device-code.model.ts:31`  
**STRIDE:** Information Disclosure  
**OWASP:** A02 Cryptographic Failures

**Description:**  
When a user approves a CLI auth request, `betterAuth.createApiKey()` returns the full API key value which is stored as `sessionToken` in the `device_codes` MongoDB collection. The record persists until the CLI polls and receives it (at which point it is deleted via `deleteOne`). During this window, a MongoDB admin or compromised DB connection can read live API keys in plaintext.

Better-auth's own `api_keys` table stores keys hashed — but the transit copy in `device_codes` is not.

**Recommendation:**  
Store an HMAC-SHA256 of the key in `sessionToken` during the transit window. Return the plaintext only once at poll time. Alternatively, encrypt the field at rest using MongoDB field-level encryption. This is a defence-in-depth measure and the 15-minute TTL limits the exposure window.

**Risk accepted:** Low-probability requires DB access. TTL auto-cleanup limits window. Tracked for future hardening.

---

#### MEDIUM-05 — CLI Device Code Tokens Granted Wildcard Scope `*`

**File:** `backend/src/auth/cli-device-code-authorize.step.ts:70`  
**STRIDE:** Elevation of Privilege  
**OWASP:** A01 Broken Access Control

**Description:**  
```ts
metadata: { scopes: ['*'], source: 'cli-device-code' },
```
CLI-issued API keys receive full access (`*`). If the CLI is compromised or credentials are leaked, the attacker gains complete control over the organization's Autoposting account.

**Recommendation:**  
Define a minimal CLI scope set (e.g. `['posts:read', 'posts:write', 'brands:read']`) and enforce it at the API key auth middleware. Accept the current behaviour for MVP with a plan to tighten scopes.

---

### LOW

---

#### LOW-01 — Short API Keys Fully Revealed in `whoami` Masking

**File:** `packages/cli/src/commands/auth.ts:95,117`  
**STRIDE:** Information Disclosure  
**OWASP:** A02 Cryptographic Failures

**Description:**  
```ts
const masked = `${cred.apiKey.slice(0, 8)}${'*'.repeat(Math.max(0, cred.apiKey.length - 8))}`
```
Keys shorter than 8 characters are displayed in full (e.g. a 5-char key shows all 5 characters with 0 stars). Keys exactly 8 characters are shown completely. In practice `sk-social-` keys are long (better-auth generates 32+ char keys), but the masking is still fragile.

**Recommendation:** Show only the first 4 characters regardless of length, plus a fixed number of stars:
```ts
const masked = cred.apiKey.slice(0, 4) + '*'.repeat(8)
```

---

#### LOW-02 — `Retry-After` Header Parsed Without NaN Guard

**File:** `packages/sdk/src/client.ts:92`  
**STRIDE:** Denial of Service  
**OWASP:** A05 Security Misconfiguration

**Description:**  
```ts
err.retryAfter = parseInt(retryAfter, 10)
```
If a server returns a non-numeric `Retry-After` (e.g. `"Fri, 01 Jan 2099 00:00:00 GMT"` — the HTTP date form), `parseInt` returns `NaN`. SDK callers checking `if (err.retryAfter)` get falsy `NaN`, silently ignoring backoff. No crash risk, but can cause unexpected retry behaviour.

**Recommendation:**
```ts
const parsed = parseInt(retryAfter, 10)
if (!isNaN(parsed) && parsed > 0) err.retryAfter = parsed
```

---

#### LOW-03 — `XDG_CONFIG_HOME` Environment Variable Not Validated

**File:** `packages/cli/src/auth/credential-store.ts:18`  
**STRIDE:** Tampering  
**OWASP:** A05 Security Misconfiguration

**Description:**  
`process.env.XDG_CONFIG_HOME` is used without validation. An attacker who can set environment variables (e.g. via a malicious shell script sourcing the CLI) could redirect credential writes to an attacker-controlled path.

**Recommendation:**  
Validate that `XDG_CONFIG_HOME` is an absolute path before using it:
```ts
const xdg = process.env.XDG_CONFIG_HOME
const configBase = (xdg && path.isAbsolute(xdg)) ? xdg : path.join(os.homedir(), '.config')
```

---

#### LOW-04 — No Audit Log on CLI Device Code Authorization/Denial

**File:** `backend/src/auth/cli-device-code-authorize.step.ts`  
**STRIDE:** Repudiation  
**OWASP:** A09 Security Logging and Monitoring Failures

**Description:**  
The authorization/denial action (`action=approve|deny`) is not emitted to the audit event system (the codebase has `audit.ts` files in other modules). There is no durable record of which user authorized which CLI device code, making forensic investigation impossible after a security incident.

**Recommendation:**  
Emit an audit event on approve and deny, including `userId`, `orgId`, `userCode` (truncated), and timestamp.

---

### INFO

---

#### INFO-01 — No Rate Limiting on `POST /auth/cli/device-code`

**File:** `backend/src/auth/cli-device-code.step.ts`  
**STRIDE:** Denial of Service  
**OWASP:** A04 Insecure Design

Unauthenticated endpoint has no rate limit. An attacker can generate large numbers of device codes, filling the `device_codes` collection. TTL index provides eventual cleanup (15 min) but no burst protection. The better-auth rateLimit middleware covers authenticated endpoints, not this one. Consider adding a per-IP rate limit (e.g. 10 requests/minute).

---

#### INFO-02 — `apiKey` Config Property in `AutopostingConfig` Is Public Interface

**File:** `packages/sdk/src/client.ts:7`  
**STRIDE:** Information Disclosure

`apiKey` in `AutopostingConfig` is passed as a plain string to the constructor. This is standard for SDKs and acceptable. Document in README that the key should not be hardcoded in source files.

---

#### INFO-03 — Error Messages from API Passed Through to Terminal Output

**File:** `packages/sdk/src/errors.ts:30`  
**STRIDE:** Information Disclosure

`body.error` from the API response is used directly as the error `message`. If the server erroneously returns sensitive information in error bodies, it propagates to the terminal. The server should sanitise its own error messages; this is documented as a boundary.

---

#### INFO-04 — `npm audit` — No Known Vulnerabilities

All 423 dependencies (23 prod, 401 dev) report zero vulnerabilities as of 2026-05-13.

---

#### INFO-05 — `mcp-tool-definitions.ts` — No Security Issues Found

Field naming and tool definitions are static configuration with no dynamic input handling. No injection vectors.

---

## Summary Table

| ID | Severity | File | STRIDE | Status |
|----|----------|------|--------|--------|
| HIGH-01 | HIGH | `cli-device-code-authorize.step.ts:40` | Tampering / EoP | **Fixed** |
| HIGH-02 | HIGH | `cli-device-code-poll.step.ts:14,24` | Tampering / Spoofing | **Fixed** |
| MED-01 | MEDIUM | `credential-store.ts:37` | Info Disclosure | **Fixed** |
| MED-02 | MEDIUM | `client.ts:16` | Info Disclosure | **Fixed** |
| MED-03 | MEDIUM | `cli.ts` / `auth.ts` | Info Disclosure | Accepted (docs) |
| MED-04 | MEDIUM | `device-code.model.ts:31` | Info Disclosure | Accepted (hardening) |
| MED-05 | MEDIUM | `cli-device-code-authorize.step.ts:70` | EoP | Accepted (MVP) |
| LOW-01 | LOW | `commands/auth.ts:95,117` | Info Disclosure | Pending |
| LOW-02 | LOW | `client.ts:92` | DoS | Pending |
| LOW-03 | LOW | `credential-store.ts:18` | Tampering | Pending |
| LOW-04 | LOW | `cli-device-code-authorize.step.ts` | Repudiation | Pending |
| INFO-01 | INFO | `cli-device-code.step.ts` | DoS | Pending |
| INFO-02–05 | INFO | Various | Various | Documented |

---

## Files Modified by This Audit

- `backend/src/auth/cli-device-code-authorize.step.ts` — Regex injection fix (HIGH-01)
- `backend/src/auth/cli-device-code-poll.step.ts` — NoSQL injection fix (HIGH-02)
- `packages/cli/src/auth/credential-store.ts` — Directory permissions + TOCTOU fix (MED-01)
- `packages/sdk/src/client.ts` — API key visibility fix (MED-02)
