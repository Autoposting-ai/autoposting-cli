import { Command } from 'commander'
import { Autoposting } from '@autoposting.ai/sdk'
import type { AuthProfile } from '@autoposting.ai/sdk'
import { resolveAuth } from '../auth/auth-manager.js'
import { readCredentials } from '../auth/credential-store.js'
import { EXIT_CODES, exitCodeFromError } from '../output/exit-codes.js'

export function createWhoamiCommand(): Command {
  return new Command('whoami')
    .description('Show the current identity and validate the key against the server')
    .action(async (_opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<{ apiKey?: string; json?: boolean }>()

      let cred: ReturnType<typeof resolveAuth>
      try {
        cred = resolveAuth({ apiKey: globals.apiKey })
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`)
        process.exitCode = exitCodeFromError(err)
        return
      }

      const masked = `${cred.apiKey.slice(0, 8)}${'*'.repeat(Math.max(0, cred.apiKey.length - 8))}`

      // Validate the key AND resolve the server-side identity in one call. /auth/profile runs
      // the shared authenticate middleware (accepts the Bearer API key), so a valid key returns
      // 200 + identity (orgId, authType) and an invalid/revoked one returns 401. A network/
      // transport failure must NOT fail whoami: degrade to "unverified" so it still works
      // offline; only a definitive rejection (401/403) exits non-zero.
      let validity: 'valid' | 'rejected' | 'unverified' = 'unverified'
      let identity: AuthProfile | undefined
      try {
        const client = new Autoposting({ apiKey: cred.apiKey, maxRetries: 0 })
        identity = await client.getProfile()
        validity = 'valid'
      } catch (err) {
        const code = exitCodeFromError(err)
        validity =
          code === EXIT_CODES.AUTH_ERROR || code === EXIT_CODES.SCOPE_ERROR
            ? 'rejected'
            : 'unverified'
      }

      const exitCode = validity === 'rejected' ? EXIT_CODES.AUTH_ERROR : 0

      const creds = cred.source === 'stored' ? readCredentials() : undefined
      const profileName = creds?.activeProfile ?? 'unknown'
      const email = creds?.profiles[profileName]?.email

      if (globals.json) {
        const out: Record<string, unknown> = {
          source: cred.source,
          apiKey: masked,
          valid: validity === 'valid',
          validity,
        }
        if (identity?.orgId) {
          out.orgId = identity.orgId
          out.authType = identity.authType
          if (identity.email) out.email = identity.email
        }
        if (cred.source === 'stored') {
          out.profile = profileName
          if (email) out.email = email
        }
        console.log(JSON.stringify(out, null, 2))
        // Set exitCode (not process.exit) so a piped --json stream flushes fully before exit.
        process.exitCode = exitCode
        return
      }

      console.log(`Source:  ${cred.source}`)
      if (cred.source === 'stored') {
        console.log(`Profile: ${profileName}`)
        if (email) console.log(`Email:   ${email}`)
      }
      if (identity?.orgId) {
        console.log(`Org:     ${identity.orgId}`)
        console.log(`Auth:    ${identity.authType}`)
      }
      const tag =
        validity === 'valid'
          ? '✓ valid'
          : validity === 'rejected'
            ? '✗ rejected by server'
            : '⚠ unverified (could not reach server)'
      console.log(`API key: ${masked}  ${tag}`)
      process.exitCode = exitCode
    })
}
