---
'@autoposting.ai/cli': patch
---

Fix `ap auth login`: read the device code from the server's `{ success, data }` envelope (it printed "Enter code undefined at undefined"), and treat the server's HTTP 400 `slow_down`, `expired_token` and `access_denied` poll answers as statuses instead of crashing.
