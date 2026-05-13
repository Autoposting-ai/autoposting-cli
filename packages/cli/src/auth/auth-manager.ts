import { getActiveProfile, getCredentialsPath } from './credential-store.js'

export interface AuthCredentials {
  apiKey: string
  source: 'flag' | 'env' | 'stored'
  profile?: string
}

export { getCredentialsPath }

/**
 * Resolves credentials using priority chain:
 * 1. --api-key flag (explicit)
 * 2. AUTOPOSTING_API_KEY env var
 * 3. Stored credentials from file (active profile)
 *
 * Throws with exit-code-2-compatible error when no auth is available.
 */
export function resolveAuth(options?: { apiKey?: string }): AuthCredentials {
  // 1. Explicit flag
  if (options?.apiKey) {
    return { apiKey: options.apiKey, source: 'flag' }
  }

  // 2. Env var
  const envKey = process.env.AUTOPOSTING_API_KEY
  if (envKey) {
    return { apiKey: envKey, source: 'env' }
  }

  // 3. Stored profile
  const profile = getActiveProfile()
  if (profile?.apiKey) {
    return { apiKey: profile.apiKey, source: 'stored' }
  }

  const err = new Error(
    'No API key found. Run `ap auth login --api-key <key>` or set AUTOPOSTING_API_KEY.',
  )
  ;(err as NodeJS.ErrnoException & { exitCode?: number }).exitCode = 2
  throw err
}
