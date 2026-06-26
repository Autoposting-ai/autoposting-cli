import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Platform } from '@autoposting.ai/sdk'

export interface ConfigFile {
  /** Default context applied when a per-call flag is absent (N1). */
  context?: { brand?: string }
  /** Per-brand, per-platform default account: handle | platformUserId | 'all' (M5). */
  defaultAccounts?: Record<string, Partial<Record<Platform, string>>>
}

export function getConfigPath(): string {
  // Same XDG resolution as the credential store; a sibling file so config never
  // shares storage with secrets (credentials.json).
  const xdg = process.env.XDG_CONFIG_HOME
  const base = xdg && path.isAbsolute(xdg) ? xdg : path.join(os.homedir(), '.config')
  return path.join(base, 'autoposting', 'config.json')
}

export function readConfig(): ConfigFile | null {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), 'utf8')) as ConfigFile
  } catch {
    // Missing or corrupt — callers start from {}. config.json holds regenerable
    // defaults (not secrets), so a corrupt read is non-fatal.
    return null
  }
}

// ponytail: mirrors credential-store's atomic temp-write+rename+chmod. Kept as a
// separate file (not a shared helper) so refactoring the tested, shipped
// credential store can't regress; the security pattern is ~12 lines.
export function writeConfig(cfg: ConfigFile): void {
  const filePath = getConfigPath()
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 })
  const tmp = `${filePath}.${process.pid}.tmp`
  try {
    fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), { encoding: 'utf8', mode: 0o600 })
    fs.renameSync(tmp, filePath)
  } catch (err) {
    try {
      fs.unlinkSync(tmp)
    } catch {
      // temp never created — nothing to clean up
    }
    throw err
  }
  fs.chmodSync(filePath, 0o600)
}

// ── Default context (N1) ───────────────────────────────────────────────────
export function getContextBrand(): string | null {
  return readConfig()?.context?.brand ?? null
}

export function setContextBrand(brand: string): void {
  const cfg = readConfig() ?? {}
  cfg.context = { ...cfg.context, brand }
  writeConfig(cfg)
}

export function unsetContextBrand(): void {
  const cfg = readConfig()
  if (!cfg?.context?.brand) return
  delete cfg.context.brand
  writeConfig(cfg)
}

/** Brand for a command: an explicit --brand wins, else the saved context, else null. */
export function resolveBrand(optBrand?: string): string | null {
  return optBrand ?? getContextBrand()
}

// ── Per-brand default accounts (M5) ────────────────────────────────────────
export function getDefaultAccount(brand: string, platform: Platform): string | null {
  return readConfig()?.defaultAccounts?.[brand]?.[platform] ?? null
}

export function getDefaultAccounts(brand: string): Partial<Record<Platform, string>> {
  return readConfig()?.defaultAccounts?.[brand] ?? {}
}

export function setDefaultAccount(brand: string, platform: Platform, value: string): void {
  const cfg = readConfig() ?? {}
  cfg.defaultAccounts ??= {}
  cfg.defaultAccounts[brand] = { ...cfg.defaultAccounts[brand], [platform]: value }
  writeConfig(cfg)
}

export function clearDefaultAccounts(brand: string): void {
  const cfg = readConfig()
  if (!cfg?.defaultAccounts?.[brand]) return
  delete cfg.defaultAccounts[brand]
  writeConfig(cfg)
}
