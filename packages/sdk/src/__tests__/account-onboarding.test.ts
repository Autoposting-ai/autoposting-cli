import { afterAll, afterEach, beforeAll, describe, it, expect } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { Autoposting } from '../client'
const base = 'https://app.autoposting.ai/api-proxy'
const id = 'a'.repeat(24)
const rowId = 'b'.repeat(24)
const tokenId = 'c'.repeat(24)
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
describe('account onboarding resource', () => {
  it('retains durable import identity across create, prepare, approval and status', async () => {
    const csv =
      'brand_name,platform,account_url\nAcme,instagram,https://instagram.com/acme'
    const requests: unknown[] = []
    server.use(
      http.post(`${base}/account-onboarding`, async ({ request }) => {
        requests.push(await request.json())
        return HttpResponse.json({ success: true, data: { id, total: 1 } })
      }),
      http.post(
        `${base}/account-onboarding/${id}/prepare`,
        async ({ request }) => {
          requests.push(await request.json())
          return HttpResponse.json({
            success: true,
            data: {
              id,
              nextOffset: null,
              rows: [{ id: rowId, prepared: true }],
            },
          })
        },
      ),
      http.post(
        `${base}/account-onboarding/${id}/rows/${rowId}/authorize`,
        () =>
          HttpResponse.json({
            success: true,
            data: {
              id,
              rowId,
              url: 'https://instagram.com/oauth/authorize',
              expiresInSeconds: 600,
            },
          }),
      ),
      http.get(`${base}/account-onboarding/${id}`, () =>
        HttpResponse.json({
          success: true,
          data: {
            id,
            total: 1,
            connected: 0,
            rows: [{ id: rowId, status: 'pending_authorization' }],
          },
        }),
      ),
    )
    const client = new Autoposting({ apiKey: 'fixture' })
    expect((await client.accountOnboarding.create({ csv })).id).toBe(id)
    expect((await client.accountOnboarding.prepare(id)).nextOffset).toBeNull()
    expect((await client.accountOnboarding.authorize(id, rowId)).rowId).toBe(
      rowId,
    )
    expect((await client.accountOnboarding.status(id)).connected).toBe(0)
    expect(requests).toEqual([{ csv }, { offset: 0 }])
  })
  it('confirmation sends the selected actual account id', async () => {
    let body
    server.use(
      http.post(
        `${base}/account-onboarding/${id}/rows/${rowId}/confirm`,
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({
            success: true,
            data: { rowId, status: 'connected', tokenId },
          })
        },
      ),
    )
    expect(
      (
        await new Autoposting({ apiKey: 'fixture' }).accountOnboarding.confirm(
          id,
          rowId,
          tokenId,
        )
      ).tokenId,
    ).toBe(tokenId)
    expect(body).toEqual({ tokenId })
  })
  it.each(['../account', 'not-an-id', 'https://evil.test', 'a'.repeat(25)])(
    'rejects unsafe import identifiers before network',
    (bad) => {
      expect(() =>
        new Autoposting({ apiKey: 'fixture' }).accountOnboarding.status(bad),
      ).toThrow(/identifiers/)
    },
  )
})
