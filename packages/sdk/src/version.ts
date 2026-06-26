// ponytail: version injected at build from package.json via tsup `env` (see tsup.config.ts),
// so package.json is the single source of truth and `changeset version` bumps flow through
// automatically — no hand-edited constant to drift. Fallback covers running src directly
// (vitest/ts-node) without a build.
export const VERSION = process.env.AUTOPOSTING_SDK_VERSION ?? '0.0.0-dev'
