import { Command } from 'commander'
import { resolveAuth } from '../auth/auth-manager.js'
import { readCredentials } from '../auth/credential-store.js'

export function createWhoamiCommand(): Command {
  return new Command('whoami')
    .description('Show current authentication identity (alias for `auth whoami`)')
    .action((_opts: Record<string, unknown>, cmd: Command) => {
      try {
        const globals = cmd.optsWithGlobals<{ apiKey?: string; json?: boolean }>()
        const cred = resolveAuth({ apiKey: globals.apiKey })

        const masked = `${cred.apiKey.slice(0, 8)}${'*'.repeat(Math.max(0, cred.apiKey.length - 8))}`

        if (globals.json) {
          const out: Record<string, string> = { source: cred.source, apiKey: masked }
          if (cred.source === 'stored') {
            const creds = readCredentials()
            const profileName = creds?.activeProfile ?? 'unknown'
            const profile = creds?.profiles[profileName]
            out.profile = profileName
            if (profile?.workspace) out.workspace = profile.workspace
            if (profile?.email) out.email = profile.email
          }
          console.log(JSON.stringify(out, null, 2))
          return
        }

        console.log(`Source:  ${cred.source}`)
        if (cred.source === 'stored') {
          const creds = readCredentials()
          const profileName = creds?.activeProfile ?? 'unknown'
          const profile = creds?.profiles[profileName]
          console.log(`Profile: ${profileName}`)
          if (profile?.workspace) console.log(`Workspace: ${profile.workspace}`)
          if (profile?.email) console.log(`Email:     ${profile.email}`)
        }
        console.log(`API key: ${masked}`)
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`)
        process.exit(2)
      }
    })
}
