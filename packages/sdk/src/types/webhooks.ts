export interface Webhook {
  id: string
  url: string
  events: string[]
  active: boolean
  secret?: string
  createdAt: string
}

export interface CreateWebhookParams {
  url: string
  events: string[]
  secret?: string
}

export interface UpdateWebhookParams {
  url?: string
  events?: string[]
  active?: boolean
}
