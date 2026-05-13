import { Command } from 'commander'
import {
  deleteAllProfiles,
  deleteProfile,
  getActiveProfile,
  readCredentials,
  saveProfile,
  setActiveProfile,
} from '../auth/credential-store.js'
import { resolveAuth } from '../auth/auth-manager.js'

export function createAuthCommand(): Command {
  const auth = new Command('auth').description('Manage authentication and profiles')

  // ap auth login --api-key <key> [--profile <name>]
  // Note: --api-key is also a root-level global option on the program. Commander consumes
  // options left-to-right so the root picks it up first. We use optsWithGlobals() to
  // merge root + local options and read whichever level captured the flag.
  auth
    .command('login')
    .description('Store an API key (device code flow coming in #13)')
    .option('--api-key <key>', 'API key to store')
    .option('--profile <name>', 'Profile name to save under', 'default')
    .action((localOpts: { apiKey?: string; profile: string }, cmd: Command) => {
      const opts = cmd.optsWithGlobals<{ apiKey?: string; profile: string }>()
      if (!opts.apiKey) {
        console.error('Error: --api-key <key> is required (device code flow not yet implemented)')
        process.exit(2)
      }

      saveProfile(opts.profile, {
        apiKey: opts.apiKey,
        createdAt: new Date().toISOString(),
      })

      console.log(`Logged in. Profile "${opts.profile}" saved.`)
    })

  // ap auth logout [--all]
  auth
    .command('logout')
    .description('Remove the active profile (or all profiles with --all)')
    .option('--all', 'Remove all stored profiles')
    .action((opts: { all?: boolean }) => {
      if (opts.all) {
        deleteAllProfiles()
        console.log('All profiles removed.')
        return
      }

      const creds = readCredentials()
      const active = creds?.activeProfile
      if (!active) {
        console.log('No active profile to log out from.')
        return
      }

      deleteProfile(active)
      console.log(`Profile "${active}" removed.`)
    })

  // ap auth switch <profile>
  auth
    .command('switch <profile>')
    .description('Switch the active profile')
    .action((profile: string) => {
      try {
        setActiveProfile(profile)
        console.log(`Switched to profile "${profile}".`)
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`)
        process.exit(2)
      }
    })

  // ap auth whoami
  auth
    .command('whoami')
    .description('Show current authentication method and identity')
    .action((_opts: Record<string, unknown>, cmd: Command) => {
      try {
        const globals = cmd.optsWithGlobals<{ apiKey?: string }>()
        const cred = resolveAuth({ apiKey: globals.apiKey })

        console.log(`Source:  ${cred.source}`)
        if (cred.source === 'stored') {
          const creds = readCredentials()
          const profileName = creds?.activeProfile ?? 'unknown'
          const profile = creds?.profiles[profileName]
          console.log(`Profile: ${profileName}`)
          if (profile?.workspace) console.log(`Workspace: ${profile.workspace}`)
          if (profile?.email) console.log(`Email:     ${profile.email}`)
        }
        // Never print the raw API key
        const masked = `${cred.apiKey.slice(0, 8)}${'*'.repeat(Math.max(0, cred.apiKey.length - 8))}`
        console.log(`API key: ${masked}`)
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`)
        process.exit(2)
      }
    })

  // ap auth status — alias for whoami
  auth
    .command('status')
    .description('Alias for whoami — show current authentication status')
    .action((_opts: Record<string, unknown>, cmd: Command) => {
      try {
        const globals = cmd.optsWithGlobals<{ apiKey?: string }>()
        const cred = resolveAuth({ apiKey: globals.apiKey })
        console.log(`Source:  ${cred.source}`)
        if (cred.source === 'stored') {
          const creds = readCredentials()
          const profileName = creds?.activeProfile ?? 'unknown'
          console.log(`Profile: ${profileName}`)
        }
        const masked = `${cred.apiKey.slice(0, 8)}${'*'.repeat(Math.max(0, cred.apiKey.length - 8))}`
        console.log(`API key: ${masked}`)
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`)
        process.exit(2)
      }
    })

  return auth
}
