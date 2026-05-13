export interface UsageSummary {
  period: string
  platforms: Record<string, { posts: number; published: number; failed: number }>
}
