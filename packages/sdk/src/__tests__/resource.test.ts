import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { Autoposting } from '../client'
import { Resource } from '../resource'

const BASE = 'https://app.autoposting.ai'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

class TestResource extends Resource {
  getItem(path: string, query?: Record<string, unknown>) {
    return this.get(path, query)
  }
  postItem(path: string, body?: unknown) {
    return this.post(path, body)
  }
  putItem(path: string, body?: unknown) {
    return this.put(path, body)
  }
  patchItem(path: string, body?: unknown) {
    return this.patch(path, body)
  }
  deleteItem(path: string) {
    return this.delete(path)
  }
}

function makeResource() {
  const client = new Autoposting({ apiKey: 'test-key' })
  return new TestResource(client)
}

describe('Resource.get', () => {
  it('delegates GET to client with correct path', async () => {
    server.use(
      http.get(`${BASE}/v1/items`, () => HttpResponse.json({ data: [{ id: '1' }] })),
    )

    const resource = makeResource()
    const result = await resource.getItem('/v1/items')
    expect(result).toEqual({ data: [{ id: '1' }] })
  })

  it('passes query params through', async () => {
    let capturedUrl = ''

    server.use(
      http.get(`${BASE}/v1/items`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({ data: [] })
      }),
    )

    const resource = makeResource()
    await resource.getItem('/v1/items', { page: 2 })

    expect(new URL(capturedUrl).searchParams.get('page')).toBe('2')
  })
})

describe('Resource.post', () => {
  it('delegates POST with body to client', async () => {
    let capturedBody: unknown = null

    server.use(
      http.post(`${BASE}/v1/items`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ id: 'new' }, { status: 201 })
      }),
    )

    const resource = makeResource()
    const result = await resource.postItem('/v1/items', { name: 'test' })

    expect(capturedBody).toEqual({ name: 'test' })
    expect(result).toEqual({ id: 'new' })
  })
})

describe('Resource.put', () => {
  it('delegates PUT with body to client', async () => {
    let capturedBody: unknown = null

    server.use(
      http.put(`${BASE}/v1/items/1`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ id: '1', name: 'updated' })
      }),
    )

    const resource = makeResource()
    const result = await resource.putItem('/v1/items/1', { name: 'updated' })

    expect(capturedBody).toEqual({ name: 'updated' })
    expect(result).toEqual({ id: '1', name: 'updated' })
  })
})

describe('Resource.patch', () => {
  it('delegates PATCH with body to client', async () => {
    let capturedBody: unknown = null

    server.use(
      http.patch(`${BASE}/v1/items/1`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ id: '1', status: 'active' })
      }),
    )

    const resource = makeResource()
    const result = await resource.patchItem('/v1/items/1', { status: 'active' })

    expect(capturedBody).toEqual({ status: 'active' })
    expect(result).toEqual({ id: '1', status: 'active' })
  })
})

describe('Resource.delete', () => {
  it('delegates DELETE to client correctly', async () => {
    let deleteCalled = false

    server.use(
      http.delete(`${BASE}/v1/items/1`, () => {
        deleteCalled = true
        return HttpResponse.json({ deleted: true })
      }),
    )

    const resource = makeResource()
    const result = await resource.deleteItem('/v1/items/1')

    expect(deleteCalled).toBe(true)
    expect(result).toEqual({ deleted: true })
  })
})
