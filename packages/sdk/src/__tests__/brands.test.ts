import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { Autoposting } from '../client'
import type { Brand, PlatformConnection } from '../types/brands'

const BASE = 'https://api.autoposting.ai'

const mockBrand: Brand = {
  id: 'brand-1',
  slug: 'my-brand',
  name: 'My Brand',
  timezone: 'America/New_York',
  platforms: [
    { platform: 'x', connected: true, username: '@mybrand' },
    { platform: 'linkedin', connected: false },
  ],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
}

const mockConnections: PlatformConnection[] = [
  { platform: 'x', connected: true, username: '@mybrand', tokenExpired: false },
  { platform: 'linkedin', connected: false },
]

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('BrandsResource', () => {
  it('list() sends GET /brands', async () => {
    server.use(
      http.get(`${BASE}/brands`, () => HttpResponse.json([mockBrand])),
    )
    const client = new Autoposting({ apiKey: 'test-key' })
    const result = await client.brands.list()
    expect(result).toEqual([mockBrand])
  })

  it('retrieve() sends GET /brands/:slug', async () => {
    server.use(
      http.get(`${BASE}/brands/my-brand`, () => HttpResponse.json(mockBrand)),
    )
    const client = new Autoposting({ apiKey: 'test-key' })
    const result = await client.brands.retrieve('my-brand')
    expect(result).toEqual(mockBrand)
  })

  it('create() sends POST /brands with params', async () => {
    let capturedBody: unknown = null
    server.use(
      http.post(`${BASE}/brands`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(mockBrand, { status: 201 })
      }),
    )
    const client = new Autoposting({ apiKey: 'test-key' })
    const result = await client.brands.create({ name: 'Test', timezone: 'UTC' })
    expect(capturedBody).toEqual({ name: 'Test', timezone: 'UTC' })
    expect(result).toEqual(mockBrand)
  })

  it('update() sends PATCH /brands/:slug with params', async () => {
    let capturedBody: unknown = null
    server.use(
      http.patch(`${BASE}/brands/my-brand`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ ...mockBrand, name: 'Updated' })
      }),
    )
    const client = new Autoposting({ apiKey: 'test-key' })
    const result = await client.brands.update('my-brand', { name: 'Updated' })
    expect(capturedBody).toEqual({ name: 'Updated' })
    expect(result.name).toBe('Updated')
  })

  it('remove() sends DELETE /brands/:slug', async () => {
    let deleteCalled = false
    server.use(
      http.delete(`${BASE}/brands/my-brand`, () => {
        deleteCalled = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const client = new Autoposting({ apiKey: 'test-key' })
    await client.brands.remove('my-brand')
    expect(deleteCalled).toBe(true)
  })

  it('authStatus() sends GET /brands/:slug/auth/status', async () => {
    server.use(
      http.get(`${BASE}/brands/my-brand/auth/status`, () =>
        HttpResponse.json(mockConnections),
      ),
    )
    const client = new Autoposting({ apiKey: 'test-key' })
    const result = await client.brands.authStatus('my-brand')
    expect(result).toEqual(mockConnections)
  })
})
