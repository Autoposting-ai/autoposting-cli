<div align="center">

# @autoposting.ai/cli

**The command-line tool for AI-powered social media automation.**

Schedule posts, manage brands, run AI agents, generate content, clip videos, and build carousels — all from your terminal. Includes a built-in MCP server with 51 tools for Claude Desktop, Cursor, and any AI agent.

[![npm](https://img.shields.io/npm/v/@autoposting.ai/cli?color=blue)](https://www.npmjs.com/package/@autoposting.ai/cli)
[![CI](https://github.com/Autoposting-ai/autoposting-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/Autoposting-ai/autoposting-cli/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/Autoposting-ai/autoposting-cli/blob/main/LICENSE)

</div>

---

## Why @autoposting.ai/cli?

- **61 commands** across 13 domains — posts, brands, agents, KB, ideas, clips, carousels, webhooks, billing, usage, workspaces, auth, utility
- **MCP server** with 51 tools — let Claude, Cursor, or any AI agent manage your social media
- **Multi-platform** — X (Twitter), LinkedIn, Instagram, Threads, YouTube
- **AI-native** — rewrite posts, score content, generate ideas, create carousels with AI
- **CI/CD ready** — JSON output, API key auth, quiet mode, exit codes
- **Shell completions** — bash, zsh, fish, PowerShell
- **Lightweight** — 123KB single-file bundle, zero runtime dependencies beyond Node.js

---

## Install

```bash
npm install -g @autoposting.ai/cli
```

Both `autoposting` and `ap` (short alias) are available after install.

---

## Quick Start

```bash
# Authenticate
export AUTOPOSTING_API_KEY=sk-social-your-key
# Or use browser login:
ap auth login

# Create and publish a post
ap posts create --brand my-brand --text "Hello world!" --platforms x,linkedin
ap posts publish <post-id>

# Run an AI agent
ap agents run <agent-id>

# Generate content ideas
ap ideas generate --topic "AI trends" --count 5

# Health check
ap doctor
```

---

## Commands

### Content Creation & Publishing

```bash
# Posts — create, schedule, publish, AI-rewrite, AI-score
ap posts create --brand my-brand --text "Launch day!" --platforms x,linkedin,threads
ap posts schedule <id> --at "2025-06-01T09:00:00Z"
ap posts publish <id>
ap posts rewrite <id>          # AI-rewrite for better engagement
ap posts score <id>            # AI scoring with feedback

# Carousels — create, AI-generate, convert to post
ap carousels generate --topic "5 Growth Tips" --brand my-brand --slides 5
ap carousels draft <id>        # convert to post draft

# Ideas — AI-generate content ideas
ap ideas generate --topic "product launch" --count 10
ap ideas enrich <id>           # add AI context

# Clips — import and render video
ap clips import --url "https://youtube.com/watch?v=..."
ap clips render <id>
```

### Social Media Management

```bash
# Brands — manage social accounts
ap brands list
ap brands auth-status my-brand   # check platform connections
ap brands create --name "My Brand" --timezone "America/New_York"

# Agents — AI-powered automated posting
ap agents create --name "Daily News" --type publish --frequency daily --time "09:00"
ap agents run <id>               # trigger immediate run
ap agents toggle <id>            # enable/disable

# Knowledge Base — feed AI with your content
ap kb create --name "Product Docs"
ap kb ingest <id> --url "https://docs.example.com"
ap kb search <id> --query "pricing"
```

### Infrastructure

```bash
# Webhooks — real-time event notifications
ap webhooks create --url "https://api.example.com/hook" --events "post.published,post.failed"
ap webhooks test <id>

# Billing & Usage
ap billing status              # plan and subscription
ap billing credits             # AI credit balance
ap usage summary               # publishing stats

# Workspaces
ap workspaces list
ap workspaces switch <id>      # session auth only
```

### Utility

```bash
ap doctor                      # health check (CLI, Node, auth, API)
ap whoami                      # current auth source
ap open posts                  # open in browser
ap update                      # check for updates
ap completion zsh >> ~/.zshrc  # shell completions
```

---

## MCP Server for AI Agents

The CLI includes a built-in MCP (Model Context Protocol) server. AI agents like Claude Desktop and Cursor can use it to manage social media autonomously.

```bash
ap mcp    # starts stdio MCP server with 51 tools
```

### Claude Desktop Setup

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "autoposting": {
      "command": "ap",
      "args": ["mcp"],
      "env": { "AUTOPOSTING_API_KEY": "sk-social-your-key" }
    }
  }
}
```

### 51 MCP Tools

| Domain | Tools | Examples |
|--------|-------|---------|
| Posts | 10 | create-post, publish-post, schedule-post, rewrite-post, score-post |
| Brands | 6 | list-brands, get-brand, create-brand, brand-auth-status |
| Agents | 8 | create-agent, run-agent, toggle-agent, agent-runs |
| Knowledge Base | 7 | create-kb, search-kb, ingest-kb, kb-docs |
| Ideas | 4 | generate-ideas, enrich-idea |
| Clips | 5 | import-clip, render-clip |
| Carousels | 6 | generate-carousel, draft-carousel |
| Webhooks | 6 | create-webhook, test-webhook |
| Billing | 2 | billing-status, billing-credits |
| Usage | 1 | usage-summary |

All tools use correct domain terminology (`brandSlug`, `text`) — no translation layer needed.

---

## CI/CD Integration

```yaml
# GitHub Actions — automated social media posting
- name: Announce release
  run: |
    npm install -g @autoposting.ai/cli
    ap posts create \
      --brand my-brand \
      --text "v${{ github.ref_name }} is live! Check it out." \
      --platforms x,linkedin \
      --json
  env:
    AUTOPOSTING_API_KEY: ${{ secrets.AUTOPOSTING_API_KEY }}
```

### Output Modes

| Mode | When | Format |
|------|------|--------|
| Interactive | TTY terminal | Tables, spinners, colors |
| JSON | `--json` or piped | Clean JSON for parsing |
| Quiet | `--quiet` | Errors only, no spinners |

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Authentication error |
| 3 | Validation error |
| 4 | Not found |
| 5 | Rate limited |
| 6 | Server error |

---

## Global Flags

| Flag | Description |
|------|-------------|
| `--api-key <key>` | Override API key |
| `--json` | JSON output |
| `--quiet` | Suppress non-essential output |
| `--format <type>` | `table` or `json` |
| `--no-color` | Disable colors |

### Auth Priority

```
--api-key flag  >  AUTOPOSTING_API_KEY env  >  ~/.config/autoposting/credentials.json
```

---

## Supported Platforms

X (Twitter) · LinkedIn · Instagram · Threads · YouTube

---

## Use Cases

- **Social media automation from terminal** — schedule and publish posts without leaving your editor
- **AI agent social media posting** — let Claude or Cursor manage your social presence via MCP
- **Automated content pipeline** — generate ideas → AI-rewrite → schedule → publish, all scripted
- **CI/CD release announcements** — auto-post when you ship
- **Multi-brand management** — manage multiple brands and platforms from one tool
- **Knowledge-driven content** — ingest docs, generate posts from your own content
- **Video clip processing** — import, render, and publish video clips
- **Carousel generation** — AI-create slide decks for LinkedIn and Instagram

---

## SDK

For programmatic access in your own applications:

```bash
npm install @autoposting.ai/sdk
```

```typescript
import { Autoposting } from '@autoposting.ai/sdk'
const client = new Autoposting({ apiKey: 'sk-social-...' })
const post = await client.posts.create({ brandSlug: 'my-brand', text: 'Hello!', platforms: ['x'] })
```

See [@autoposting.ai/sdk on npm](https://www.npmjs.com/package/@autoposting.ai/sdk) for full SDK docs.

---

## License

MIT — see [LICENSE](https://github.com/Autoposting-ai/autoposting-cli/blob/main/LICENSE).

---

<div align="center">

Built by **[Autoposting.ai](https://autoposting.ai)** — AI-powered social media scheduling for X, LinkedIn, Instagram, Threads, and YouTube.

[Website](https://autoposting.ai) · [SDK](https://www.npmjs.com/package/@autoposting.ai/sdk) · [GitHub](https://github.com/Autoposting-ai/autoposting-cli) · [@iuditg](https://x.com/iuditg)

</div>
