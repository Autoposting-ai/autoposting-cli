// Shape of GET /usage/summary `data` (see backend get-usage-summary.step.ts).
export interface UsageSummary {
  range: { from: string; to: string }
  posts: {
    total: number
    published: number
    bySource: {
      dashboard: number
      api: number
      mcp: number
      cli: number
      agent: number
    }
  }
  agents: { total: number; active: number }
  ai: {
    totalCostUsd: number
    inputTokens: number
    outputTokens: number
    totalTokens: number
    requests: number
    byModel: {
      model: string
      costUsd: number
      inputTokens: number
      outputTokens: number
      requests: number
    }[]
  }
  trend: {
    posts: { date: string; count: number }[]
    aiCost: { date: string; costUsd: number; requests: number }[]
  }
}
