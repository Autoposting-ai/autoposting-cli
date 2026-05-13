import { Resource } from '../resource'
import type { BillingStatus, CreditBalance } from '../types/billing'

export class BillingResource extends Resource {
  status(): Promise<BillingStatus> {
    return this.get<BillingStatus>('/billing/status')
  }

  credits(): Promise<CreditBalance> {
    return this.get<CreditBalance>('/billing/credits')
  }
}
