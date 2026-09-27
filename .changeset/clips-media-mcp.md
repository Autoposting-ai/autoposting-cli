---
"@autoposting.ai/cli": patch
"@autoposting.ai/sdk": patch
---

Fix AI clipping and post media over the CLI, SDK and local MCP server: `clips import` sends the brand, `clips render` sends the current edit revision, new `clips draft` turns a rendered clip into a draft post, and `create-post` / `update-post` MCP tools accept media URLs.
