import { Resource } from '../resource'
import type { Webhook, CreateWebhookParams, UpdateWebhookParams } from '../types/webhooks'

export class WebhooksResource extends Resource {
  list(): Promise<Webhook[]> {
    return this.get<Webhook[]>('/webhooks')
  }

  retrieve(id: string): Promise<Webhook> {
    return this.get<Webhook>(`/webhooks/${id}`)
  }

  create(params: CreateWebhookParams): Promise<Webhook> {
    return this.post<Webhook>('/webhooks', params)
  }

  update(id: string, params: UpdateWebhookParams): Promise<Webhook> {
    return this.patch<Webhook>(`/webhooks/${id}`, params)
  }

  remove(id: string): Promise<void> {
    return this.client.request<void>('DELETE', `/webhooks/${id}`)
  }

  test(id: string): Promise<void> {
    return this.post<void>(`/webhooks/${id}/test`)
  }
}
