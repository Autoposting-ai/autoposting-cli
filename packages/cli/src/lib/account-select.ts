import type { Autoposting, Platform, PlatformConnection } from '@autoposting.ai/sdk'

// PlatformConnection v0.3.3 already has platformUserId, platformAccountType, profileImageUrl.
type AccountEntry = PlatformConnection

const VALID_PLATFORMS: readonly Platform[] = ['x', 'linkedin', 'instagram', 'threads', 'youtube']

/**
 * Resolves --account p=handle|id flags + interactive picker into targetAccountIds.
 *
 * Logic per targeted platform:
 *  - --account specified → resolve handle/id → push platformUserId (unknown → throw)
 *  - ≥2 connected accounts, TTY → checkbox multiselect via @inquirer/prompts
 *  - ≥2 connected accounts, non-TTY → throw with list + usage hint
 *  - 0 or 1 account → omit platform (backend defaults to all connected)
 */
export async function resolveTargetAccounts({
  brandSlug,
  platforms,
  accountFlags,
  client,
  isTty,
}: {
  brandSlug: string
  platforms: Platform[]
  accountFlags: string[]
  client: Autoposting
  isTty: boolean
}): Promise<Partial<Record<Platform, string[]>>> {
  // Validate flag format BEFORE any network call (fast fail on bad input).
  const accountMap: Partial<Record<Platform, string>> = {}
  for (const flag of accountFlags) {
    const eqIdx = flag.indexOf('=')
    if (eqIdx < 1) {
      throw Object.assign(
        new Error(`--account: expected "platform=handle|id" format, got "${flag}"`),
        { exitCode: 1 },
      )
    }
    const p = flag.slice(0, eqIdx).trim()
    if (!VALID_PLATFORMS.includes(p as Platform)) {
      throw Object.assign(
        new Error(`--account: unknown platform "${p}". Valid: ${VALID_PLATFORMS.join(', ')}`),
        { exitCode: 1 },
      )
    }
    accountMap[p as Platform] = flag.slice(eqIdx + 1).trim()
  }

  // If no --account flags and platforms all would get 0-1 connections, skip the API call
  // only if we know there's nothing to resolve. We can't know without fetching, so always fetch.
  const connections = (await client.brands.authStatus(brandSlug)) as AccountEntry[]

  // Group connected accounts by platform.
  const byPlatform: Partial<Record<Platform, AccountEntry[]>> = {}
  for (const conn of connections) {
    if (!conn.connected) continue
    const p = conn.platform as Platform
    if (!byPlatform[p]) byPlatform[p] = []
    byPlatform[p]!.push(conn)
  }

  const result: Partial<Record<Platform, string[]>> = {}

  for (const platform of platforms) {
    const accounts = byPlatform[platform] ?? []
    const specifiedValue = accountMap[platform]

    if (specifiedValue !== undefined) {
      // Resolve handle (strip leading @, case-insensitive) or platformUserId.
      const normalized = specifiedValue.startsWith('@') ? specifiedValue.slice(1) : specifiedValue
      const match = accounts.find(
        (a) =>
          a.platformUsername?.toLowerCase() === normalized.toLowerCase() ||
          a.platformUserId === specifiedValue,
      )
      if (!match?.platformUserId) {
        const valid = accounts
          .map((a) => `  @${a.platformUsername ?? '?'} (${a.platformUserId ?? '?'})`)
          .join('\n')
        throw Object.assign(
          new Error(
            `--account: unknown ${platform} account "${specifiedValue}".\n` +
            `Connected accounts:\n${valid || '  (none)'}`,
          ),
          { exitCode: 1 },
        )
      }
      if (!result[platform]) result[platform] = []
      result[platform]!.push(match.platformUserId)
    } else if (accounts.length >= 2) {
      if (isTty) {
        // ponytail: lazy import keeps @inquirer/prompts out of non-TTY/test paths
        const { checkbox } = await import('@inquirer/prompts')
        const choices = accounts.map((a) => ({
          name: `@${a.platformUsername ?? '?'} (${a.platformUserId ?? '?'})`,
          value: a.platformUserId ?? '',
        }))
        const selected: string[] = await checkbox({
          message: `Multiple ${platform} accounts connected — select which to post to:`,
          choices,
        })
        const valid = selected.filter(Boolean)
        if (valid.length > 0) result[platform] = valid
      } else {
        const list = accounts
          .map((a) => `  @${a.platformUsername ?? '?'} (${a.platformUserId ?? '?'})`)
          .join('\n')
        throw Object.assign(
          new Error(
            `Multiple ${platform} accounts connected but no --account specified (non-interactive mode).\n` +
            `Connected accounts:\n${list}\n` +
            `Pass --account ${platform}=<handle|id> to select.`,
          ),
          { exitCode: 1 },
        )
      }
    }
    // 0 or 1 account: omit from targetAccountIds — backend posts to all connected.
  }

  return result
}
