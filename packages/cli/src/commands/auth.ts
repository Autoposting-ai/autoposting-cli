import { Command } from 'commander'
import { execSync } from 'node:child_process'
import {
  deleteAllProfiles,
  deleteProfile,
  getActiveProfile,
  readCredentials,
  saveProfile,
  setActiveProfile,
} from '../auth/credential-store.js'
import { resolveAuth } from '../auth/auth-manager.js'
import { requestDeviceCode, pollDeviceCode } from '../auth/device-code-client.js'

const DEFAULT_BASE_URL = 'https://app.autoposting.ai'

function resolveBaseUrl(globals: { baseUrl?: string }): string {
  return globals.baseUrl ?? process.env.AUTOPOSTING_BASE_URL ?? DEFAULT_BASE_URL
}

function tryOpenUrl(url: string): void {
  try {
    // Attempt to open browser; ignore failures (CI, headless, etc.)
    const platform = process.platform
    if (platform === 'darwin') execSync(`open "${url}"`, { stdio: 'ignore' })
    else if (platform === 'win32') execSync(`start "" "${url}"`, { stdio: 'ignore' })
    else execSync(`xdg-open "${url}"`, { stdio: 'ignore' })
  } catch {
    // Non-fatal: user can open URL manually
  }
}

export function createAuthCommand(): Command {
  const auth = new Command('auth').description('Manage authentication and profiles')

  // ap auth login [--api-key <key>] [--profile <name>] [--base-url <url>]
  // Note: --api-key is also a root-level global option on the program. Commander consumes
  // options left-to-right so the root picks it up first. We use optsWithGlobals() to
  // merge root + local options and read whichever level captured the flag.
  auth
    .command('login')
    .description('Log in via browser device code flow, or store an API key directly with --api-key')
    .option('--api-key <key>', 'API key to store directly (skips device code flow)')
    .option('--profile <name>', 'Profile name to save under', 'default')
    .option('--base-url <url>', 'API base URL (overrides AUTOPOSTING_BASE_URL)')
    .action(async (localOpts: { apiKey?: string; profile: string; baseUrl?: string }, cmd: Command) => {
      const opts = cmd.optsWithGlobals<{ apiKey?: string; profile: string; baseUrl?: string }>()

      // Fast path: --api-key provided, store directly
      if (opts.apiKey) {
        saveProfile(opts.profile, {
          apiKey: opts.apiKey,
          createdAt: new Date().toISOString(),
        })
        console.log(`Logged in. Profile "${opts.profile}" saved.`)
        return
      }

      // Device code flow
      const baseUrl = resolveBaseUrl(opts)

      let deviceCodeResp
      try {
        deviceCodeResp = await requestDeviceCode(baseUrl)
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`)
        process.exit(2)
      }

      const { deviceCode, userCode, verificationUri } = deviceCodeResp
      let pollInterval = deviceCodeResp.interval

      console.log(`\nEnter code ${userCode} at ${verificationUri}\n`)
      tryOpenUrl(verificationUri)

      // Spinner-style wait indicator using process.stdout so we can overwrite it
      const frames = ['|', '/', '-', '\\']
      let frameIdx = 0
      const spinnerInterval = setInterval(() => {
        process.stdout.write(`\rWaiting for authorization... ${frames[frameIdx++ % frames.length]}`)
      }, 100)

      const clearSpinner = () => {
        clearInterval(spinnerInterval)
        process.stdout.write('\r\x1b[K') // clear spinner line
      }

      // Poll loop
      while (true) {
        await new Promise<void>((resolve) => setTimeout(resolve, pollInterval * 1000))

        let result
        try {
          result = await pollDeviceCode(baseUrl, deviceCode)
        } catch (err) {
          clearSpinner()
          console.error(`Error: ${(err as Error).message}`)
          process.exit(2)
        }

        switch (result.status) {
          case 'complete': {
            clearSpinner()
            const token = result.sessionToken!
            saveProfile(opts.profile, {
              apiKey: token,
              createdAt: new Date().toISOString(),
            })
            console.log(`Logged in. Profile "${opts.profile}" saved.`)
            return
          }

          case 'expired_token':
            clearSpinner()
            console.error('Error: Authorization expired. Run `ap auth login` again.')
            process.exit(2)
            break

          case 'access_denied':
            clearSpinner()
            console.error('Error: Access denied.')
            process.exit(2)
            break

          case 'slow_down':
            // Double the interval as instructed by server
            pollInterval = result.interval ?? pollInterval * 2
            break

          case 'authorization_pending':
          default:
            // Continue polling
            break
        }
      }
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
