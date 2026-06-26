// Shape of GET /billing/status `data` (see backend get-billing-status.step.ts).
// Dates are serialized to ISO strings over the wire; null when no subscription row.
export interface BillingStatus {
  plan: string
  planName: string
  billingCycle: string | null
  status: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  trialEnd: string | null
  isTrialing: boolean
  cancelledAt: string | null
  suspendedAt: string | null
  pendingPlan: string | null
  pendingChangeDate: string | null
  dodoCustomerId: string | null
  setupFeeVerified: boolean
  accountLimit: number
  accountsUsed: number
  creditBalance: number
  costMultiplier: number
}

// Shape of GET /billing/credits `data` (see backend get-credit-balance.step.ts).
export interface CreditBalance {
  balance: number
  balanceFormatted: string
  recentUsage: {
    date: string
    description: string
    amount: number
    type: string
  }[]
  totalSpent30d: number
}
