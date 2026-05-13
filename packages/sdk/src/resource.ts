import type { Autoposting } from './client'

export abstract class Resource {
  constructor(protected client: Autoposting) {}

  protected get<T>(path: string, query?: Record<string, unknown>): Promise<T> {
    return this.client.request<T>('GET', path, undefined, query)
  }

  protected post<T>(path: string, body?: unknown): Promise<T> {
    return this.client.request<T>('POST', path, body)
  }

  protected put<T>(path: string, body?: unknown): Promise<T> {
    return this.client.request<T>('PUT', path, body)
  }

  protected patch<T>(path: string, body?: unknown): Promise<T> {
    return this.client.request<T>('PATCH', path, body)
  }

  protected delete<T>(path: string): Promise<T> {
    return this.client.request<T>('DELETE', path)
  }
}
