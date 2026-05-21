import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')
const installDir = mkdtempSync(path.join(tmpdir(), 'ap-pack-smoke-'))

function run(command, args, options = {}) {
  const output = execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  })
  return typeof output === 'string' ? output.trim() : ''
}

function pack(workspace) {
  const fileName = run('npm', ['pack', `--workspace=${workspace}`, '--silent'])
  return path.join(repoRoot, fileName)
}

try {
  run('npm', ['run', 'build'], { stdio: 'inherit' })

  const sdkPackage = pack('packages/sdk')
  const cliPackage = pack('packages/cli')

  run('npm', ['init', '-y'], { cwd: installDir })
  run('npm', ['install', sdkPackage, cliPackage], { cwd: installDir })

  const importCheck = [
    "import('@autoposting.ai/sdk')",
    ".then((m) => { if (typeof m.Autoposting !== 'function') throw new Error('missing Autoposting export') })",
  ].join('')
  run('node', ['--input-type=module', '-e', importCheck], { cwd: installDir })

  const requireCheck = [
    "const m = require('@autoposting.ai/sdk');",
    "if (typeof m.Autoposting !== 'function') throw new Error('missing Autoposting export');",
  ].join('')
  run('node', ['-e', requireCheck], { cwd: installDir })

  const apBin = path.join(installDir, 'node_' + 'modules', '.bin', 'ap')
  const version = run(apBin, ['--version'])
  if (!/^\d+\.\d+\.\d+/.test(version)) {
    throw new Error(`CLI version output is invalid: ${version}`)
  }

  console.log(`Pack smoke passed for SDK and CLI (${version}).`)
} finally {
  rmSync(installDir, { recursive: true, force: true })
}
