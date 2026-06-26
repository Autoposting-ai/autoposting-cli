import { Command } from 'commander'
import { Autoposting } from '@autoposting.ai/sdk'
import { resolveAuth } from '../auth/auth-manager.js'
import { readCredentials } from '../auth/credential-store.js'
import { EXIT_CODES, exitCodeFromError } from '../output/exit-codes.js'

type ActiveWorkspace = { name: string; slug: string }

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
        process.exit(exitCodeFromError(err))
        return
      }

      const masked = `${cred.apiKey.slice(0, 8)}${'*'.repeat(Math.max(0, cred.apiKey.length - 8))}`

      // Validate the key against the API. A definitive rejection (401/403) means the key
      // is bad → non-zero exit. A network/transport failure must NOT fail whoami: degrade
      // to showing local identity as "unverified" so the command still works offline.
      let validity: 'valid' | 'rejected' | 'unverified' = 'unverified'
      let active: ActiveWorkspace | undefined
      let workspaceCount = 0
      try {
        const client = new Autoposting({ apiKey: cred.apiKey })
        const workspaces = await client.workspaces.list()
        workspaceCount = workspaces.length
        const found = workspaces.find((w) => w.isActive) ?? workspaces[0]
        if (found) active = { name: found.name, slug: found.slug }
        validity = 'valid'
      } catch (err) {
        const code = exitCodeFromError(err)
        validity =
          code === EXIT_CODES.AUTH_ERROR || code === EXIT_CODES.SCOPE_ERROR
            ? 'rejected'
            : 'unverified'
      }

      const exitCode = validity === 'rejected' ? EXIT_CODES.AUTH_ERROR : 0

      if (globals.json) {
        const out: Record<string, unknown> = {
          source: cred.source,
          apiKey: masked,
          valid: validity === 'valid',
          validity,
          workspaceCount,
        }
        if (active) out.activeWorkspace = active
        if (cred.source === 'stored') {
          const creds = readCredentials()
          const profileName = creds?.activeProfile ?? 'unknown'
          const profile = creds?.profiles[profileName]
          out.profile = profileName
          if (profile?.email) out.email = profile.email
        }
        console.log(JSON.stringify(out, null, 2))
        process.exit(exitCode)
        return
      }

      console.log(`Source:  ${cred.source}`)
      if (cred.source === 'stored') {
        const creds = readCredentials()
        const profileName = creds?.activeProfile ?? 'unknown'
        const profile = creds?.profiles[profileName]
        console.log(`Profile: ${profileName}`)
        if (profile?.email) console.log(`Email:     ${profile.email}`)
      }
      if (active) console.log(`Workspace: ${active.name} (${active.slug})`)
      const tag =
        validity === 'valid'
          ? '✓ valid'
          : validity === 'rejected'
            ? '✗ rejected by server'
            : '⚠ unverified (could not reach server)'
      console.log(`API key: ${masked}  ${tag}`)
      process.exit(exitCode)
    })
}
