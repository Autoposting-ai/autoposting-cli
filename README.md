<div align="center">

# Autoposting CLI

**Manage your social media empire from the terminal.**

Schedule posts, manage brands, run AI agents, generate content ideas, clip videos, build carousels, and more — all from a single command-line tool.

[![npm SDK](https://img.shields.io/npm/v/@autoposting.ai/sdk?label=%40autoposting.ai%2Fsdk&color=blue)](https://www.npmjs.com/package/@autoposting.ai/sdk)
[![npm CLI](https://img.shields.io/npm/v/@autoposting.ai/cli?label=%40autoposting.ai%2Fcli&color=blue)](https://www.npmjs.com/package/@autoposting.ai/cli)
[![CI](https://github.com/Autoposting-ai/autoposting-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/Autoposting-ai/autoposting-cli/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[![Follow @iuditg](https://img.shields.io/badge/Follow-@iuditg-000000?style=flat&logo=x&logoColor=white)](https://x.com/intent/follow?screen_name=iuditg)
[![Autoposting.ai](https://img.shields.io/badge/Autoposting.ai-Visit-purple)](https://autoposting.ai)

<br>

**61 commands** across **13 domains** · **51 MCP tools** for AI agents · **TypeScript SDK** for programmatic access

<br>

[Install](#install) · [Quick Start](#quick-start) · [Commands](#commands) · [SDK](#sdk) · [MCP Server](#mcp-server) · [FAQ](#faq)

</div>

---

```
     POSTS            BRANDS           AGENTS              KB             IDEAS            CLIPS
 ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
 │  Create  │     │  Create  │     │  Create  │     │  Create  │     │ Generate │     │  Import  │
 │ Schedule │     │  Connect │     │   Run    │     │  Ingest  │     │  Enrich  │     │  Render  │
 │ Publish  │     │  Status  │     │  Toggle  │     │  Search  │     │  List    │     │  List    │
 └──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
 ap posts          ap brands         ap agents         ap kb           ap ideas          ap clips

  CAROUSELS         WEBHOOKS          BILLING           USAGE         WORKSPACES         UTILITY
 ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
 │ Generate │     │  Create  │     │  Status  │     │ Summary  │     │   List   │     │  Doctor  │
 │  Draft   │     │   Test   │     │ Credits  │     │          │     │  Switch  │     │  Whoami  │
 │  List    │     │  Update  │     │          │     │          │     │          │     │   Open   │
 └──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
 ap carousels      ap webhooks       ap billing        ap usage       ap workspaces     ap doctor
```

---

## Install

```bash
npm install -g @autoposting.ai/cli
```

After installing, both `autoposting` and `ap` (short alias) are available globally.

```bash
ap --help
```

---

## Quick Start

### 1. Authenticate

**Option A — API Key (recommended for CI/CD):**

```bash
export AUTOPOSTING_API_KEY=sk-social-your-key-here
```

**Option B — Browser Login (recommended for humans):**

```bash
ap auth login
```

Opens your browser, shows a device code, and completes authentication automatically.

### 2. Create Your First Post

```bash
# Draft a post
ap posts create --brand my-brand --text "Hello from the terminal!" --platforms x,linkedin

# Schedule it
ap posts schedule <post-id> --at "2025-01-15T09:00:00Z"

# Or publish immediately
ap posts publish <post-id>
```

### 3. Check Your Setup

```bash
ap doctor        # verify CLI, Node.js, auth, API connectivity
ap whoami         # show current auth source and masked key
ap brands list    # list all brands in your workspace
```

---

## Commands

### Posts

| Command | Description |
|---------|-------------|
| `ap posts list` | List posts (filter by brand, status, page) |
| `ap posts get <id>` | Get a post by ID |
| `ap posts create` | Create a new post draft |
| `ap posts update <id>` | Update text, platforms, or schedule |
| `ap posts delete <id>` | Delete a post (requires `--force`) |
| `ap posts publish <id>` | Publish immediately |
| `ap posts schedule <id>` | Schedule for a specific time |
| `ap posts retry <id>` | Retry a failed post |
| `ap posts rewrite <id>` | AI-rewrite post text |
| `ap posts score <id>` | AI-score with feedback |

### Brands

| Command | Description |
|---------|-------------|
| `ap brands list` | List all brands |
| `ap brands get <slug>` | Get brand details |
| `ap brands create` | Create a new brand |
| `ap brands update <slug>` | Update name or timezone |
| `ap brands delete <slug>` | Delete a brand (requires `--force`) |
| `ap brands auth-status <slug>` | Show platform connection status |

### Agents

| Command | Description |
|---------|-------------|
| `ap agents list` | List all agents |
| `ap agents get <id>` | Get agent details |
| `ap agents create` | Create a publish or research agent |
| `ap agents update <id>` | Update agent config |
| `ap agents delete <id>` | Delete an agent (requires `--force`) |
| `ap agents run <id>` | Trigger immediate run |
| `ap agents toggle <id>` | Enable/disable |
| `ap agents runs <id>` | View run history |

### Knowledge Base

| Command | Description |
|---------|-------------|
| `ap kb list` | List all knowledge bases |
| `ap kb get <id>` | Get KB details |
| `ap kb create` | Create a new KB |
| `ap kb delete <id>` | Delete a KB (requires `--force`) |
| `ap kb search <id>` | Search KB with a query |
| `ap kb ingest <id>` | Ingest a URL into KB |
| `ap kb docs <id>` | List documents in KB |

### Ideas

| Command | Description |
|---------|-------------|
| `ap ideas generate` | AI-generate content ideas |
| `ap ideas list` | List saved ideas |
| `ap ideas enrich <id>` | Enrich idea with AI context |
| `ap ideas delete <id>` | Delete an idea |

### Clips

| Command | Description |
|---------|-------------|
| `ap clips list` | List all video clips |
| `ap clips get <id>` | Get clip details |
| `ap clips import` | Import video from URL |
| `ap clips render <id>` | Trigger rendering |
| `ap clips delete <id>` | Delete a clip (requires `--force`) |

### Carousels

| Command | Description |
|---------|-------------|
| `ap carousels list` | List all carousels |
| `ap carousels get <id>` | Get carousel details |
| `ap carousels create` | Create empty carousel |
| `ap carousels generate` | AI-generate from topic |
| `ap carousels draft <id>` | Convert to post draft |
| `ap carousels delete <id>` | Delete carousel (requires `--force`) |

### Webhooks

| Command | Description |
|---------|-------------|
| `ap webhooks list` | List all webhooks |
| `ap webhooks get <id>` | Get webhook details |
| `ap webhooks create` | Create endpoint |
| `ap webhooks update <id>` | Update URL, events, or active state |
| `ap webhooks delete <id>` | Delete webhook (requires `--force`) |
| `ap webhooks test <id>` | Send test event |

### Billing & Usage

| Command | Description |
|---------|-------------|
| `ap billing status` | Current plan and subscription |
| `ap billing credits` | AI credit balance |
| `ap usage summary` | Post and publishing usage |

### Workspaces

| Command | Description |
|---------|-------------|
| `ap workspaces list` | List all workspaces |
| `ap workspaces switch <id>` | Switch active workspace (session auth only) |

### Utility

| Command | Description |
|---------|-------------|
| `ap doctor` | Health check (CLI, Node, auth, API) |
| `ap whoami` | Show auth source and masked key |
| `ap open [section]` | Open autoposting.ai in browser |
| `ap update` | Check for CLI updates |
| `ap completion <shell>` | Generate shell completions (bash/zsh/fish/pwsh) |
| `ap mcp` | Start MCP server for AI agents |
| `ap auth login` | Authenticate via browser or API key |
| `ap auth logout` | Clear stored credentials |
| `ap auth status` | Show auth status |

---

## Global Flags

| Flag | Description |
|------|-------------|
| `--api-key <key>` | Override API key for this command |
| `--json` | Output as JSON (for piping) |
| `--quiet` | Suppress spinners and non-essential output |
| `--format <type>` | Output format: `table` or `json` |
| `--no-color` | Disable color output |

### Auth Priority Chain

```
--api-key flag  >  AUTOPOSTING_API_KEY env  >  stored credentials (~/.config/autoposting/)
```

### Output Modes

| Context | Behavior |
|---------|----------|
| TTY (interactive) | Formatted tables, spinners, colors |
| Piped / `--json` | Clean JSON output |
| `--quiet` | Suppress spinners, errors only |

---

## SDK

The TypeScript SDK powers the CLI and is available as a standalone package.

```bash
npm install @autoposting.ai/sdk
```

```typescript
import { Autoposting } from '@autoposting.ai/sdk'

const client = new Autoposting({ apiKey: 'sk-social-...' })

// Create a post
const post = await client.posts.create({
  brandSlug: 'my-brand',
  text: 'Hello from the SDK!',
  platforms: ['x', 'linkedin'],
})

// List all brands
const brands = await client.brands.list()

// Run an agent
await client.agents.run('agent-id')

// Search knowledge base
const results = await client.kb.search('kb-id', { query: 'product launch' })

// Generate ideas
const ideas = await client.ideas.generate({ topic: 'AI trends', count: 5 })

// Check billing
const status = await client.billing.status()
```

### SDK Resources

| Resource | Methods |
|----------|---------|
| `client.posts` | list, retrieve, create, update, remove, publish, schedule, retry, rewrite, score |
| `client.brands` | list, retrieve, create, update, remove, authStatus |
| `client.agents` | list, retrieve, create, update, remove, run, toggle, runs |
| `client.kb` | list, retrieve, create, remove, search, ingest, docs |
| `client.ideas` | list, generate, enrich, remove |
| `client.clips` | list, retrieve, import, render, remove |
| `client.carousels` | list, retrieve, create, generate, draft, remove |
| `client.webhooks` | list, retrieve, create, update, remove, test |
| `client.billing` | status, credits |
| `client.usage` | summary |
| `client.workspaces` | list, switchWorkspace |

### Error Handling

```typescript
import { AuthenticationError, RateLimitError, NotFoundError } from '@autoposting.ai/sdk'

try {
  await client.posts.retrieve('nonexistent')
} catch (err) {
  if (err instanceof NotFoundError) console.log('Post not found')
  if (err instanceof AuthenticationError) console.log('Invalid API key')
  if (err instanceof RateLimitError) console.log('Slow down!')
}
```

---

## MCP Server

The CLI includes a built-in MCP (Model Context Protocol) server with **51 tools** covering all SDK resources. Use it with Claude Desktop, Cursor, or any MCP-compatible client.

```bash
ap mcp
```

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "autoposting": {
      "command": "ap",
      "args": ["mcp"],
      "env": {
        "AUTOPOSTING_API_KEY": "sk-social-your-key-here"
      }
    }
  }
}
```

### Available Tools (51)

Posts (10) · Brands (6) · Agents (8) · KB (7) · Ideas (4) · Clips (5) · Carousels (6) · Webhooks (6) · Billing (2) · Usage (1)

All tools use correct domain terminology (`brandSlug`, `text`) and follow kebab-case naming (`create-post`, `list-brands`, `run-agent`).

---

## CI/CD

Use the CLI in pipelines with API key auth:

```yaml
# GitHub Actions example
- name: Publish scheduled posts
  run: |
    npm install -g @autoposting.ai/cli
    ap posts list --status scheduled --json | jq '.[0].id' | xargs ap posts publish
  env:
    AUTOPOSTING_API_KEY: ${{ secrets.AUTOPOSTING_API_KEY }}
```

---

## Shell Completions

```bash
# Bash
ap completion bash >> ~/.bashrc

# Zsh
ap completion zsh >> ~/.zshrc

# Fish
ap completion fish > ~/.config/fish/completions/ap.fish

# PowerShell
ap completion pwsh >> $PROFILE
```

---

## Development

This is a [Turborepo](https://turbo.build) monorepo with two packages:

```
autoposting-cli/
├── packages/
│   ├── sdk/          @autoposting.ai/sdk — TypeScript API client
│   └── cli/          @autoposting.ai/cli — Commander.js CLI + MCP server
├── .github/
│   └── workflows/    CI + Release (npm publish on tag push)
├── .changeset/       Lockstep versioning via Changesets
└── Dockerfile        Docker image (node:20-alpine)
```

```bash
npm install           # install dependencies
npx turbo build       # build SDK + CLI
npx turbo test        # run 255 tests
```

### Release Process

```bash
npx changeset                  # create a changeset
npx changeset version          # bump versions (lockstep)
git commit && git tag v0.X.Y   # commit + tag
git push origin main --tags    # triggers npm publish via GitHub Actions
```

---

## FAQ

**Q: What platforms does Autoposting support?**
A: X (Twitter), LinkedIn, Instagram, Threads, and YouTube.

**Q: How do I get an API key?**
A: Sign up at [autoposting.ai](https://autoposting.ai), go to Settings > API Keys. Keys use the `sk-social-` prefix.

**Q: Can I use the CLI in Docker?**
A: Yes. `docker run autoposting/cli posts list`

**Q: What's the difference between `ap auth login` and `--api-key`?**
A: `ap auth login` opens a browser for OAuth (device code flow) and stores credentials locally. `--api-key` is for CI/CD or one-off commands — no browser needed.

**Q: Does `ap mcp` work with Cursor?**
A: Yes. Any MCP-compatible client can connect via stdio. Configure the command as `ap mcp` with your API key in the environment.

**Q: What Node.js version do I need?**
A: Node.js 20 or later.

---

## License

MIT — see [LICENSE](LICENSE).

---

<div align="center">

## About

Built by **[Autoposting.ai](https://autoposting.ai)** — the multi-channel social media scheduling and AI content platform.

**Connect:** [autoposting.ai](https://autoposting.ai) · [@iuditg](https://x.com/iuditg) · [GitHub](https://github.com/Autoposting-ai)

</div>
