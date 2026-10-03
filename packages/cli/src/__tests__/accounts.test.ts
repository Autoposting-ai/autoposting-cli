import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { Command } from 'commander'
import { createAccountsCommand } from '../commands/accounts.js'
import { handleToolCall } from '../mcp/handler.js'
import { ALL_TOOLS } from '../mcp/tools.js'
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  prepare: vi.fn(),
  status: vi.fn(),
  authorize: vi.fn(),
  confirm: vi.fn(),
  log: vi.fn(),
  error: vi.fn(),
  readFile: vi.fn(),
}))
vi.mock('@autoposting.ai/sdk', () => ({
  Autoposting: class {
    accountOnboarding = {
      create: mocks.create,
      prepare: mocks.prepare,
      status: mocks.status,
      authorize: mocks.authorize,
      confirm: mocks.confirm,
    }
  },
}))
vi.mock('../auth/auth-manager.js', () => ({
  resolveAuth: () => ({ apiKey: 'fixture' }),
}))
vi.mock('../output/printer.js', () => ({
  createPrinter: () => ({ log: mocks.log, error: mocks.error }),
}))
vi.mock('node:fs/promises', () => ({ readFile: mocks.readFile }))
const id = 'a'.repeat(24)
const row = 'b'.repeat(24)
beforeEach(() => {
  vi.clearAllMocks()
  mocks.create.mockResolvedValue({ id })
  mocks.prepare.mockResolvedValue({ id, nextOffset: null })
  mocks.status.mockResolvedValue({ id, connected: 0 })
  mocks.authorize.mockResolvedValue({
    url: 'https://instagram.com/oauth/authorize',
  })
  mocks.confirm.mockResolvedValue({ status: 'connected' })
  mocks.readFile.mockResolvedValue('csv-contents')
})
afterEach(() => {
  process.exitCode = 0
})
async function command(args: string[]) {
  const program = new Command().exitOverride()
  program.addCommand(createAccountsCommand())
  await program.parseAsync(['node', 'ap', 'accounts', ...args])
}
describe('accounts CLI and MCP', () => {
  it('reads a local CSV and sends contents, not a filesystem path', async () => {
    await command(['import', '--from', 'accounts.csv'])
    expect(mocks.readFile).toHaveBeenCalledWith('accounts.csv', 'utf8')
    expect(mocks.create).toHaveBeenCalledWith({ csv: 'csv-contents' })
    expect(mocks.log).toHaveBeenCalledWith({ id })
  })
  it('resumes preparation with the next offset', async () => {
    await command(['prepare', id, '--offset', '25'])
    expect(mocks.prepare).toHaveBeenCalledWith(id, 25)
  })
  it('prints approval link without opening a browser or marking connected', async () => {
    await command(['authorize', id, row])
    expect(mocks.authorize).toHaveBeenCalledWith(id, row)
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(mocks.log).toHaveBeenCalledWith({
      url: 'https://instagram.com/oauth/authorize',
    })
  })
  it('rejects invalid offsets before sending a request', async () => {
    await command(['prepare', id, '--offset', 'nan'])
    expect(mocks.prepare).not.toHaveBeenCalled()
    expect(mocks.error).toHaveBeenCalled()
  })
  it('surfaces API errors without claiming success', async () => {
    mocks.authorize.mockRejectedValue(new Error('Plan limit reached'))
    await command(['authorize', id, row])
    expect(mocks.error).toHaveBeenCalled()
    expect(mocks.log).not.toHaveBeenCalled()
  })
  it.each([
    ['import-accounts', { csv: 'csv' }, 'create', [{ csv: 'csv' }]],
    ['prepare-account-import', { id, offset: 25 }, 'prepare', [id, 25]],
    ['account-import-status', { id }, 'status', [id, {}]],
    ['authorize-import-account', { id, rowId: row }, 'authorize', [id, row]],
    [
      'confirm-import-account',
      { id, rowId: row, tokenId: id },
      'confirm',
      [id, row, id],
    ],
  ])(
    'routes MCP %s through the shared SDK',
    async (name, args, method, expected) => {
      const client = { accountOnboarding: mocks }
      const result = await handleToolCall(
        name as string,
        args as Record<string, unknown>,
        client as never,
      )
      expect(result.isError).not.toBe(true)
      expect(mocks[method as keyof typeof mocks]).toHaveBeenCalledWith(
        ...(expected as unknown[]),
      )
    },
  )
  it('requires explicit human identity confirmation in tool instructions', () => {
    expect(
      ALL_TOOLS.find((t) => t.name === 'confirm-import-account')!.description,
    ).toContain('explicitly confirms')
  })
})
