<div align="center">

# @autoposting.ai/sdk

**TypeScript SDK for AI-powered social media automation.**

The official Node.js / TypeScript client for the [Autoposting.ai](https://autoposting.ai) API — schedule posts, manage brands, run AI agents, generate content ideas, clip videos, build carousels, and automate social media publishing across X (Twitter), LinkedIn, Instagram, Threads, and YouTube.

[![npm](https://img.shields.io/npm/v/@autoposting.ai/sdk?color=blue)](https://www.npmjs.com/package/@autoposting.ai/sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-first--class-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/Autoposting-ai/autoposting-cli/blob/main/LICENSE)

</div>

---

## Why @autoposting.ai/sdk?

- **AI Agent Friendly** — Built for AI agents that need to post to social media. Pairs with the [MCP server](#mcp-server-for-ai-agents) for Claude Desktop, Cursor, and any MCP-compatible AI assistant.
- **Multi-Platform** — One API for X (Twitter), LinkedIn, Instagram, Threads, and YouTube.
- **AI Content Generation** — Generate post ideas, rewrite content, score posts, and create carousels with AI.
- **TypeScript-First** — Full type definitions, typed errors, and autocomplete for every resource.
- **Zero Dependencies** — Uses native `fetch` (Node.js 20+). No axios, no node-fetch.
- **Lightweight** — 13KB bundled (ESM + CJS + type definitions).

---

## Install

```bash
npm install @autoposting.ai/sdk
```

```bash
yarn add @autoposting.ai/sdk
```

```bash
pnpm add @autoposting.ai/sdk
```

---

## Quick Start

```typescript
import { Autoposting } from '@autoposting.ai/sdk'

const client = new Autoposting({ apiKey: 'sk-social-...' })

// Schedule a post to X and LinkedIn
const post = await client.posts.create({
  brandSlug: 'my-brand',
  text: 'Launching our new AI features today!',
  platforms: ['x', 'linkedin'],
  scheduledAt: '2025-01-15T09:00:00Z',
})

// Publish immediately
await client.posts.publish(post.id)
```

---

## Usage Examples

### Social Media Post Scheduling

```typescript
// List all scheduled posts
const posts = await client.posts.list({ status: 'scheduled' })

// Create and schedule a post
const post = await client.posts.create({
  brandSlug: 'my-brand',
  text: 'Check out our latest blog post!',
  platforms: ['x', 'linkedin', 'threads'],
  scheduledAt: '2025-02-01T14:00:00Z',
})

// AI-rewrite a post for better engagement
await client.posts.rewrite(post.id)

// Get AI score and feedback
const score = await client.posts.score(post.id)
```

### Brand Management

```typescript
// List all brands in your workspace
const brands = await client.brands.list()

// Check which platforms are connected
const status = await client.brands.authStatus('my-brand')
```

### AI Agents for Automated Posting

```typescript
// Create an AI agent that posts daily
const agent = await client.agents.create({
  name: 'Daily Tech News',
  type: 'publish',
  brandSlug: 'my-brand',
  prompt: 'Write a short post about the latest AI news',
  frequency: 'daily',
  time: '09:00',
})

// Trigger an immediate run
await client.agents.run(agent.id)

// View run history
const runs = await client.agents.runs(agent.id)
```

### Knowledge Base & Content Ideas

```typescript
// Create a knowledge base and ingest content
const kb = await client.kb.create({ name: 'Product Docs' })
await client.kb.ingest(kb.id, { url: 'https://docs.example.com' })

// Search your knowledge base
const results = await client.kb.search(kb.id, { query: 'pricing' })

// Generate content ideas from your KB
const ideas = await client.ideas.generate({
  kbId: kb.id,
  topic: 'product updates',
  count: 10,
})
```

### Video Clips & Carousels

```typescript
// Import and process a video clip
const clip = await client.clips.import({ url: 'https://youtube.com/watch?v=...' })
await client.clips.render(clip.id)

// AI-generate a carousel from a topic
const carousel = await client.carousels.generate({
  topic: '5 Tips for Social Media Growth',
  brandSlug: 'my-brand',
  slideCount: 5,
})

// Convert carousel to a post draft
await client.carousels.draft(carousel.id)
```

### Webhooks for Real-Time Events

```typescript
// Get notified when posts are published
const webhook = await client.webhooks.create({
  url: 'https://api.example.com/webhook',
  events: ['post.published', 'post.failed'],
})

// Send a test event
await client.webhooks.test(webhook.id)
```

### Billing & Usage

```typescript
const billing = await client.billing.status()
const credits = await client.billing.credits()
const usage = await client.usage.summary()
```

---

## API Reference

### Resources

| Resource | Methods |
|----------|---------|
| `client.posts` | `list` · `retrieve` · `create` · `update` · `remove` · `publish` · `schedule` · `retry` · `rewrite` · `score` |
| `client.brands` | `list` · `retrieve` · `create` · `update` · `remove` · `authStatus` |
| `client.agents` | `list` · `retrieve` · `create` · `update` · `remove` · `run` · `toggle` · `runs` |
| `client.kb` | `list` · `retrieve` · `create` · `remove` · `search` · `ingest` · `docs` |
| `client.ideas` | `list` · `generate` · `enrich` · `remove` |
| `client.clips` | `list` · `retrieve` · `import` · `render` · `remove` |
| `client.carousels` | `list` · `retrieve` · `create` · `generate` · `draft` · `remove` |
| `client.webhooks` | `list` · `retrieve` · `create` · `update` · `remove` · `test` |
| `client.billing` | `status` · `credits` |
| `client.usage` | `summary` |
| `client.workspaces` | `list` · `switchWorkspace` |

### Error Handling

The SDK throws typed errors you can catch by class:

```typescript
import {
  AutopostingError,     // base class
  AuthenticationError,  // 401 — invalid API key
  ScopeError,           // 403 — insufficient API key scopes
  NotFoundError,        // 404 — resource not found
  ValidationError,      // 400/422 — invalid input
  RateLimitError,       // 429 — rate limited
  ServerError,          // 5xx — server error
} from '@autoposting.ai/sdk'

try {
  await client.posts.retrieve('nonexistent')
} catch (err) {
  if (err instanceof NotFoundError) {
    console.log('Post not found:', err.message)
  }
  if (err instanceof RateLimitError) {
    console.log('Rate limited, retry after:', err.message)
  }
}
```

### Configuration

```typescript
const client = new Autoposting({
  apiKey: 'sk-social-...',         // required
  baseUrl: 'https://custom.api',   // optional, defaults to production
  timeout: 30000,                  // optional, request timeout in ms
})
```

### Auth Priority (when using with CLI)

```
--api-key flag  >  AUTOPOSTING_API_KEY env  >  stored credentials
```

---

## MCP Server for AI Agents

This SDK powers the Autoposting MCP server — **51 tools** that let AI agents (Claude, Cursor, GPT) manage social media autonomously.

Install the CLI to get the MCP server:

```bash
npm install -g @autoposting.ai/cli
ap mcp  # starts stdio MCP server
```

**Claude Desktop config:**

```json
{
  "mcpServers": {
    "autoposting": {
      "command": "ap",
      "args": ["mcp"],
      "env": { "AUTOPOSTING_API_KEY": "sk-social-..." }
    }
  }
}
```

Once connected, your AI agent can create posts, schedule content, run AI agents, search knowledge bases, and manage your entire social media presence — all through natural language.

---

## CLI

The companion CLI (`@autoposting.ai/cli`) provides 61 terminal commands:

```bash
npm install -g @autoposting.ai/cli

ap posts create --brand my-brand --text "Hello!" --platforms x,linkedin
ap agents run <agent-id>
ap kb search <kb-id> --query "product launch"
```

See the [CLI documentation](https://github.com/Autoposting-ai/autoposting-cli) for the full command reference.

---

## Supported Platforms

| Platform | Post | Schedule | AI Rewrite | Analytics |
|----------|------|----------|------------|-----------|
| X (Twitter) | Yes | Yes | Yes | Yes |
| LinkedIn | Yes | Yes | Yes | Yes |
| Instagram | Yes | Yes | Yes | Yes |
| Threads | Yes | Yes | Yes | Yes |
| YouTube | Yes | Yes | Yes | Yes |

---

## Use Cases

- **Social media automation** — Schedule and publish posts across multiple platforms from your app
- **AI agent social media posting** — Let AI agents manage your social presence via MCP
- **Content pipeline** — Generate ideas → create posts → AI-rewrite → schedule → publish
- **Social media management API** — Build custom dashboards and tools on top of the Autoposting API
- **Automated content repurposing** — Clip videos, generate carousels, cross-post across platforms
- **CI/CD social media publishing** — Automate announcements from your deployment pipeline
- **Knowledge-driven posting** — Ingest docs into a KB, generate posts from your own content

---

## License

MIT — see [LICENSE](https://github.com/Autoposting-ai/autoposting-cli/blob/main/LICENSE).

---

<div align="center">

Built by **[Autoposting.ai](https://autoposting.ai)** — AI-powered social media scheduling for X, LinkedIn, Instagram, Threads, and YouTube.

[Website](https://autoposting.ai) · [CLI](https://www.npmjs.com/package/@autoposting.ai/cli) · [GitHub](https://github.com/Autoposting-ai/autoposting-cli) · [@iuditg](https://x.com/iuditg)

</div>
