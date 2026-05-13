# Autoposting CLI + SDK

Manage social media from the terminal.

## Packages

| Package | Description |
|---------|-------------|
| [`@autoposting.ai/sdk`](./packages/sdk) | TypeScript SDK for the Autoposting API |
| [`autoposting-cli`](./packages/cli) | CLI tool (`autoposting` / `ap` commands) |

## Install

```bash
npm install -g autoposting-cli
```

## Usage

```bash
autoposting --help
ap --help
```

## Development

```bash
npm install
npm run build
npm test
```

## Publishing

```bash
npm run changeset   # create a changeset
npx changeset version  # bump versions
npx changeset publish  # publish to npm
```
