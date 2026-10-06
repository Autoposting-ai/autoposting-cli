# Bulk preview safety

Outcome: `posts create --from ... --dry-run` and `--preview` resolve every row without uploads or post creation, preserving explicit Facebook Page IDs and all six formats.

Cause: the command's bulk branch omits the dry-run flag; its shared bulk helper always calls the normal create path. Single-post preview already works.

Scope: forward the existing flag into the shared helper, return resolved preview bodies, retain normal bulk results and partial failures. No new dependencies or publishing changes.

Validation: real child-process regressions for both aliases and local media; existing bulk and Facebook tests; typecheck/build/full suite/packed package. Repeat the published-client guarded acceptance after the correction releases. The guard already blocked all attempted production writes in the failing acceptance.

Release: focused PR to main, synchronized SDK/CLI patch through existing release workflow. Do not describe 0.5.2 bulk preview as safe.

## Evidence

- Published 0.5.2 guarded live bulk preview attempted six POST /posts calls; guard blocked every write.
- Both preview aliases failed local child-process no-write assertions before the fix; four normal bulk cases stayed green.
- Focused green: 24 tests. Full corrected source: CLI 423, SDK 140, packed MCP 8. Typecheck/build and packed SDK/CLI smoke passed.
- Corrected built client: all six formats preserve explicit Page ID and canonical ordered media; live guard records six GETs, zero mutations. This proves preview construction, not provider publication.
- Existing MCP dependency updated from 1.29.0 to 1.31.0; production npm audit zero vulnerabilities. GHSA-6qxp-vccf-f47h describes HTTP OAuth clients, explicitly excludes servers/stdio clients; this app uses stdio server. The minimum patched version keeps the mandatory release audit green without adding dependencies.

Pending: exact-head PR checks, merge, synchronized 0.5.3 tag release, fresh published-client acceptance. All broader Facebook provider/recovery/customer-MCP acceptance remains pending.
