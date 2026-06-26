import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export interface StoredProfile {
  apiKey: string
  workspace?: string
  email?: string
  createdAt: string
}

export interface CredentialsFile {
  activeProfile: string
  profiles: Record<string, StoredProfile>
}

export function getCredentialsPath(): string {
  // Per the XDG spec, XDG_CONFIG_HOME is honoured only when set to an absolute path;
  // empty or relative values must be ignored and fall back to ~/.config.
  const xdg = process.env.XDG_CONFIG_HOME
  const configBase = xdg && path.isAbsolute(xdg) ? xdg : path.join(os.homedir(), '.config')
  return path.join(configBase, 'autoposting', 'credentials.json')
}

export function readCredentials(): CredentialsFile | null {
  const filePath = getCredentialsPath()
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(raw) as CredentialsFile
  } catch {
    // Missing or corrupt file — return null gracefully
    return null
  }
}

export function writeCredentials(creds: CredentialsFile): void {
  const filePath = getCredentialsPath()
  const dir = path.dirname(filePath)

  // Use { recursive: true } so mkdirSync is idempotent (avoids TOCTOU race between
  // existsSync + mkdirSync). Mode 0o700 ensures only the owning user can read the dir.
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })

  // Write to a temp file then rename — an atomic swap on the same filesystem, so a
  // crash or a concurrent writer can never leave a half-written credentials file.
  const tmpPath = `${filePath}.${process.pid}.tmp`
  fs.writeFileSync(tmpPath, JSON.stringify(creds, null, 2), { encoding: 'utf8', mode: 0o600 })
  fs.renameSync(tmpPath, filePath)

  // Ensure 0600 even if file already existed before
  fs.chmodSync(filePath, 0o600)
}

export function saveProfile(name: string, profile: StoredProfile): void {
  const existing = readCredentials()
  // readCredentials() returns null for BOTH missing and corrupt files. If the file is
  // present but unparseable, preserve it (rename to .corrupt) instead of silently
  // dropping every other stored profile by overwriting with a fresh file.
  if (!existing && fs.existsSync(getCredentialsPath())) {
    try {
      fs.renameSync(getCredentialsPath(), `${getCredentialsPath()}.corrupt`)
    } catch {
      // best-effort backup — proceed to write a fresh file regardless
    }
  }
  const creds: CredentialsFile = existing ?? { activeProfile: name, profiles: {} }
  creds.profiles[name] = profile
  creds.activeProfile = name
  writeCredentials(creds)
}

export function deleteProfile(name: string): void {
  const creds = readCredentials()
  if (!creds) return

  delete creds.profiles[name]

  // If deleted profile was active, clear active or pick another
  if (creds.activeProfile === name) {
    const remaining = Object.keys(creds.profiles)
    creds.activeProfile = remaining[0] ?? ''
  }

  writeCredentials(creds)
}

export function deleteAllProfiles(): void {
  writeCredentials({ activeProfile: '', profiles: {} })
}

export function getActiveProfile(): StoredProfile | null {
  const creds = readCredentials()
  if (!creds || !creds.activeProfile) return null
  return creds.profiles[creds.activeProfile] ?? null
}

export function setActiveProfile(name: string): void {
  const creds = readCredentials()
  if (!creds) throw new Error(`Profile "${name}" does not exist (no credentials file)`)
  if (!creds.profiles[name]) throw new Error(`Profile "${name}" does not exist`)
  creds.activeProfile = name
  writeCredentials(creds)
}
