import { Resource } from '../resource'
import type { UsageSummary } from '../types/usage'

export class UsageResource extends Resource {
  summary(): Promise<UsageSummary> {
    return this.get<UsageSummary>('/usage/summary')
  }
}
