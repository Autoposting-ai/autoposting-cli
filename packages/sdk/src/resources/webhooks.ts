import { Resource } from '../resource'
import type { Webhook, CreateWebhookParams, UpdateWebhookParams } from '../types/webhooks'

export class WebhooksResource extends Resource {
  list(): Promise<Webhook[]> {
    return this.get<Webhook[]>('/webhooks')
  }

  // NOTE: the backend has no GET /webhooks/:id route — this 404s until front-back adds it.
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

  // POST /webhooks/:id/test — backend returns `{ delivered, httpStatus }`.
  test(id: string): Promise<{ delivered: boolean; httpStatus: number }> {
    return this.post<{ delivered: boolean; httpStatus: number }>(`/webhooks/${id}/test`)
  }
}
