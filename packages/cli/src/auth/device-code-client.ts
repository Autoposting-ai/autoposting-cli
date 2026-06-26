export interface DeviceCodeResponse {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

export interface PollResult {
  status: 'authorization_pending' | 'complete' | 'expired_token' | 'access_denied' | 'slow_down'
  sessionToken?: string
  orgId?: string
  interval?: number
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(
      `Expected a JSON response (HTTP ${res.status}) but received non-JSON. ` +
        `Verify the API base URL points at the API, not the web app.`,
    )
  }
}

export async function requestDeviceCode(baseUrl: string): Promise<DeviceCodeResponse> {
  const res = await fetchWithTimeout(`${baseUrl}/auth/cli/device-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Device code request failed (${res.status}): ${text}`)
  }

  return parseJson<DeviceCodeResponse>(res)
}

export async function pollDeviceCode(baseUrl: string, deviceCode: string): Promise<PollResult> {
  const url = `${baseUrl}/auth/cli/poll?device_code=${encodeURIComponent(deviceCode)}`
  const res = await fetchWithTimeout(url)

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Poll request failed (${res.status}): ${text}`)
  }

  return parseJson<PollResult>(res)
}
