import { Command } from 'commander'
import { resolveAuth } from '../auth/auth-manager.js'
import { getCredentialsPath } from '../auth/credential-store.js'
import fs from 'node:fs'

const VERSION = '0.1.0'
const API_HEALTH_URL = 'https://app.autoposting.ai/api/health'

type CheckResult = {
  name: string
  status: 'pass' | 'fail' | 'warn'
  value: string
}

async function runChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = []

  // CLI Version
  results.push({ name: 'CLI Version', status: 'pass', value: VERSION })

  // Node.js
  const nodeVersion = process.version
  const nodeMajor = parseInt(nodeVersion.slice(1), 10)
  results.push({
    name: 'Node.js',
    status: nodeMajor >= 20 ? 'pass' : 'fail',
    value: nodeVersion,
  })

  // Auth
  try {
    resolveAuth()
    results.push({ name: 'Auth', status: 'pass', value: 'authenticated' })
  } catch {
    results.push({ name: 'Auth', status: 'fail', value: 'not configured' })
  }

  // Credentials file permissions
  const credPath = getCredentialsPath()
  try {
    const stat = fs.statSync(credPath)
    const mode = stat.mode & 0o777
    const isSecure = mode === 0o600
    results.push({
      name: 'Credentials',
      status: isSecure ? 'pass' : 'warn',
      value: isSecure ? `${credPath} (0600)` : `${credPath} (mode ${mode.toString(8)} — expected 0600)`,
    })
  } catch {
    results.push({ name: 'Credentials', status: 'warn', value: 'no credentials file found' })
  }

  // API health
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(API_HEALTH_URL, { signal: controller.signal })
    clearTimeout(timeout)
    results.push({
      name: 'API',
      status: res.ok ? 'pass' : 'fail',
      value: `HTTP ${res.status}`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    results.push({ name: 'API', status: 'fail', value: `unreachable: ${msg}` })
  }

  return results
}

export function createDoctorCommand(): Command {
  const cmd = new Command('doctor')
    .description('Run diagnostic checks on your CLI setup')
    .option('--json', 'Output results as JSON')
    .action(async (_opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<{ json?: boolean }>()
      const results = await runChecks()

      if (globals.json) {
        console.log(JSON.stringify(results, null, 2))
      } else {
        for (const r of results) {
          const icon = r.status === 'pass' ? '✓' : r.status === 'warn' ? '!' : '✗'
          const label = r.status === 'pass' ? 'pass' : r.status === 'warn' ? 'warn' : 'FAIL'
          console.log(`  ${icon} ${r.name.padEnd(16)} [${label}]  ${r.value}`)
        }
      }

      const anyFail = results.some((r) => r.status === 'fail')
      if (anyFail) process.exit(1)
    })

  return cmd
}
