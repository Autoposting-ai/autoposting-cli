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

export async function requestDeviceCode(baseUrl: string): Promise<DeviceCodeResponse> {
  const res = await fetch(`${baseUrl}/auth/cli/device-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Device code request failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as DeviceCodeResponse
  return data
}

export async function pollDeviceCode(baseUrl: string, deviceCode: string): Promise<PollResult> {
  const url = `${baseUrl}/auth/cli/poll?device_code=${encodeURIComponent(deviceCode)}`
  const res = await fetch(url)

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Poll request failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as PollResult
  return data
}
