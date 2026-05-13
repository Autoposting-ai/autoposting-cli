export interface BillingStatus {
  plan: string
  status: 'active' | 'trialing' | 'canceled' | 'past_due'
  trialEndsAt?: string
  renewalDate?: string
  cancelAt?: string
}

export interface CreditBalance {
  total: number
  used: number
  remaining: number
  breakdown?: Record<string, number>
}
