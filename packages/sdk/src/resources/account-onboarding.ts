import { Resource } from '../resource'
import type { Platform } from '../types'
export interface AccountImportRow {
  brand_name: string
  brand_slug?: string
  platform: Platform
  account_url: string
  timezone?: string
  account_type?: 'personal' | 'organization'
}
export interface AccountImport {
  id: string
  total: number
  next: string
}
export type AccountImportRowStatus =
  | 'unprepared'
  | 'permission_denied'
  | 'pending_authorization'
  | 'needs_confirmation'
  | 'connected'
  | 'reconnect_required'
  | 'authorization_failed'
  | 'account_mismatch'
export interface AccountImportStatus {
  id: string
  total: number
  nextOffset: number | null
  connected: number
  unprepared: number
  capacity: {
    plan: string
    limit: number | null
    currentCount: number
    remaining: number | null
  }
  rows: Array<{
    id: string
    brandName?: string
    brandSlug?: string
    platform?: Platform
    accountUrl?: string
    status: AccountImportRowStatus
    error?: string
    lastError?: string
    accounts?: Array<{
      tokenId: string
      accountId?: string
      name?: string
      usable: boolean
    }>
  }>
}
export interface AccountApproval {
  id: string
  rowId: string
  url: string
  accountUrl: string
  expiresInSeconds: number
  instructions: string
}
const segment = (value: string) => {
  if (!/^[a-f0-9]{24}$/.test(value))
    throw new Error(
      'Import and row identifiers must be 24-character hexadecimal strings',
    )
  return value
}
export class AccountOnboardingResource extends Resource {
  remove(id: string): Promise<{ id: string; deleted: boolean }> {
    return this.delete(`/account-onboarding/${segment(id)}`)
  }
  create(
    input: { csv: string } | { rows: AccountImportRow[] },
  ): Promise<AccountImport> {
    return this.post('/account-onboarding', input)
  }
  status(
    id: string,
    query?: { offset?: number; limit?: number },
  ): Promise<AccountImportStatus> {
    return this.get(`/account-onboarding/${segment(id)}`, query)
  }
  prepare(
    id: string,
    offset = 0,
  ): Promise<{
    id: string
    rows: Array<{
      id: string
      brandSlug: string
      prepared: boolean
      error?: string
    }>
    nextOffset: number | null
  }> {
    return this.post(`/account-onboarding/${segment(id)}/prepare`, { offset })
  }
  authorize(id: string, rowId: string): Promise<AccountApproval> {
    return this.post(
      `/account-onboarding/${segment(id)}/rows/${segment(rowId)}/authorize`,
    )
  }
  confirm(
    id: string,
    rowId: string,
    tokenId: string,
  ): Promise<{ rowId: string; status: string; tokenId: string }> {
    return this.post(
      `/account-onboarding/${segment(id)}/rows/${segment(rowId)}/confirm`,
      { tokenId: segment(tokenId) },
    )
  }
}
