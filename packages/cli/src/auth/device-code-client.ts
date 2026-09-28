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

  // The server wraps the fields in its usual {success, data} envelope.
  const { data } = await parseJson<{ data?: DeviceCodeResponse }>(res)
  if (!data?.deviceCode || !data.userCode || !data.verificationUri) {
    throw new Error('Device code response is missing deviceCode, userCode or verificationUri.')
  }
  return data
}

export async function pollDeviceCode(baseUrl: string, deviceCode: string): Promise<PollResult> {
  const url = `${baseUrl}/auth/cli/poll?device_code=${encodeURIComponent(deviceCode)}`
  const res = await fetchWithTimeout(url)

  const text = await res.text().catch(() => res.statusText)
  let body: Partial<PollResult> = {}
  try {
    body = JSON.parse(text) as Partial<PollResult>
  } catch {
    // handled below
  }
  // The server answers slow_down, expired_token and access_denied with HTTP 400 and a status.
  if (res.ok || (res.status === 400 && body.status)) {
    if (!body.status) throw new Error(`Poll response (HTTP ${res.status}) has no status.`)
    return body as PollResult
  }
  throw new Error(`Poll request failed (${res.status}): ${text}`)
}
