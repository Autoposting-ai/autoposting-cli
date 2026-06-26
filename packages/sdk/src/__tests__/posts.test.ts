import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { Autoposting } from '../client'
import type { Post } from '../types/posts'

const BASE = 'https://app.autoposting.ai/api-proxy'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    brandSlug: 'my-brand',
    text: 'Hello world',
    platforms: ['x', 'linkedin'],
    status: 'draft',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

// Every backend success response is wrapped as { success: true, data: <payload> }.
// The SDK unwraps it, so mocks must wrap and assertions check the unwrapped payload.
function wrap<T>(data: T) {
  return { success: true, data }
}

function makeClient() {
  return new Autoposting({ apiKey: 'test-key' })
}

describe('posts.list()', () => {
  it('sends GET /posts and returns the bare array (envelope unwrapped)', async () => {
    const posts = [makePost()]

    server.use(http.get(`${BASE}/posts`, () => HttpResponse.json(wrap(posts))))

    const client = makeClient()
    const result = await client.posts.list()
    expect(result).toEqual(posts)
  })

  it('includes brandSlug query param when provided', async () => {
    let capturedUrl = ''

    server.use(
      http.get(`${BASE}/posts`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json(wrap([]))
      }),
    )

    const client = makeClient()
    await client.posts.list({ brandSlug: 'my-brand' })

    expect(new URL(capturedUrl).searchParams.get('brandSlug')).toBe('my-brand')
  })

  it('includes status query param when provided', async () => {
    let capturedUrl = ''

    server.use(
      http.get(`${BASE}/posts`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json(wrap([]))
      }),
    )

    const client = makeClient()
    await client.posts.list({ status: 'published' })

    expect(new URL(capturedUrl).searchParams.get('status')).toBe('published')
  })

  it('translates limit + page into limit + offset (backend paginates by offset)', async () => {
    let capturedUrl = ''

    server.use(
      http.get(`${BASE}/posts`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json(wrap([]))
      }),
    )

    const client = makeClient()
    await client.posts.list({ limit: 5, page: 2 })

    const url = new URL(capturedUrl)
    expect(url.searchParams.get('limit')).toBe('5')
    // page 2 @ limit 5 → offset 5; `page` is never sent to the backend
    expect(url.searchParams.get('offset')).toBe('5')
    expect(url.searchParams.get('page')).toBeNull()
  })
})

describe('posts.getById()', () => {
  it('sends GET /posts/:id and returns the unwrapped post', async () => {
    const post = makePost({ id: 'abc-123' })

    server.use(http.get(`${BASE}/posts/abc-123`, () => HttpResponse.json(wrap(post))))

    const client = makeClient()
    const result = await client.posts.getById('abc-123')
    expect(result).toEqual(post)
  })
})

describe('posts.create()', () => {
  it('sends POST /posts with brandSlug, text, and platforms', async () => {
    let capturedBody: unknown = null
    const post = makePost()

    server.use(
      http.post(`${BASE}/posts`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(wrap(post), { status: 201 })
      }),
    )

    const client = makeClient()
    const result = await client.posts.create({
      brandSlug: 'my-brand',
      text: 'Hello world',
      platforms: ['x', 'linkedin'],
    })

    expect(capturedBody).toEqual({
      brandSlug: 'my-brand',
      text: 'Hello world',
      platforms: ['x', 'linkedin'],
    })
    expect(result).toEqual(post)
  })

  it('includes scheduledAt when provided', async () => {
    let capturedBody: unknown = null

    server.use(
      http.post(`${BASE}/posts`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(
          wrap(makePost({ status: 'scheduled', scheduledAt: '2024-06-01T10:00:00Z' })),
        )
      }),
    )

    const client = makeClient()
    await client.posts.create({
      brandSlug: 'my-brand',
      text: 'Scheduled post',
      platforms: ['x'],
      scheduledAt: '2024-06-01T10:00:00Z',
    })

    expect((capturedBody as { scheduledAt: string }).scheduledAt).toBe('2024-06-01T10:00:00Z')
  })

  it('forwards a thread array when provided', async () => {
    let capturedBody: unknown = null

    server.use(
      http.post(`${BASE}/posts`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(wrap(makePost()), { status: 201 })
      }),
    )

    const client = makeClient()
    await client.posts.create({
      brandSlug: 'my-brand',
      text: 'Hook',
      platforms: ['x'],
      thread: ['reply one', 'reply two'],
    })

    expect((capturedBody as { thread: string[] }).thread).toEqual(['reply one', 'reply two'])
  })
})

describe('posts.update()', () => {
  it('sends PUT /posts/:id with update params', async () => {
    let capturedBody: unknown = null
    const post = makePost({ text: 'Updated text' })

    server.use(
      http.put(`${BASE}/posts/post-1`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(wrap(post))
      }),
    )

    const client = makeClient()
    const result = await client.posts.update('post-1', { text: 'Updated text' })

    expect(capturedBody).toEqual({ text: 'Updated text' })
    expect(result.text).toBe('Updated text')
  })
})

describe('posts.remove()', () => {
  it('sends DELETE /posts/:id and resolves', async () => {
    let deleteCalled = false

    server.use(
      http.delete(`${BASE}/posts/post-1`, () => {
        deleteCalled = true
        return HttpResponse.json(wrap({ id: 'post-1' }))
      }),
    )

    const client = makeClient()
    await client.posts.remove('post-1')
    expect(deleteCalled).toBe(true)
  })
})

describe('posts.publish()', () => {
  it('sends POST /posts/:id/publish', async () => {
    const post = makePost({ status: 'published', publishedAt: '2024-01-02T00:00:00Z' })

    server.use(http.post(`${BASE}/posts/post-1/publish`, () => HttpResponse.json(wrap(post))))

    const client = makeClient()
    const result = await client.posts.publish('post-1')
    expect(result.status).toBe('published')
  })
})

describe('posts.schedule()', () => {
  it('sends PUT /posts/:id/schedule with scheduledAt in body', async () => {
    let capturedBody: unknown = null
    const post = makePost({ status: 'scheduled', scheduledAt: '2024-06-01T10:00:00Z' })

    server.use(
      http.put(`${BASE}/posts/post-1/schedule`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(wrap(post))
      }),
    )

    const client = makeClient()
    const result = await client.posts.schedule('post-1', '2024-06-01T10:00:00Z')

    expect(capturedBody).toEqual({ scheduledAt: '2024-06-01T10:00:00Z' })
    expect(result.status).toBe('scheduled')
  })
})

describe('posts.retry()', () => {
  it('sends POST /posts/:id/retry', async () => {
    let retryCalled = false
    const post = makePost()

    server.use(
      http.post(`${BASE}/posts/post-1/retry`, () => {
        retryCalled = true
        return HttpResponse.json(wrap(post))
      }),
    )

    const client = makeClient()
    await client.posts.retry('post-1')
    expect(retryCalled).toBe(true)
  })
})

describe('posts.rewrite()', () => {
  it('sends POST /posts/:id/rewrite', async () => {
    const rewritten = makePost({ text: 'Rewritten text' })

    server.use(http.post(`${BASE}/posts/post-1/rewrite`, () => HttpResponse.json(wrap(rewritten))))

    const client = makeClient()
    const result = await client.posts.rewrite('post-1')
    expect(result.text).toBe('Rewritten text')
  })
})

describe('posts.score()', () => {
  it('sends POST /posts/:id/score and returns the unwrapped score', async () => {
    server.use(
      http.post(`${BASE}/posts/post-1/score`, () => HttpResponse.json(wrap({ score: 87 }))),
    )

    const client = makeClient()
    const result = await client.posts.score('post-1')
    expect(result.score).toBe(87)
  })
})
