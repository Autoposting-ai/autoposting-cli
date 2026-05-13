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
  const configBase = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config')
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

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  fs.writeFileSync(filePath, JSON.stringify(creds, null, 2), { encoding: 'utf8', mode: 0o600 })

  // Ensure 0600 even if file already existed before
  fs.chmodSync(filePath, 0o600)
}

export function saveProfile(name: string, profile: StoredProfile): void {
  const existing = readCredentials()
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
