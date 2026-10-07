import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { Autoposting, VERSION } from '@autoposting.ai/sdk'
import { ALL_TOOLS } from './tools.js'
import { handleToolCall } from './handler.js'
import { resolveAuth } from '../auth/auth-manager.js'

export async function startMcpServer(options?: { apiKey?: string }): Promise<void> {
  const client = new Autoposting({ apiKey: resolveAuth(options).apiKey })

  const server = new Server(
    { name: 'autoposting-mcp', version: VERSION },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: ALL_TOOLS,
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    return handleToolCall(name, (args ?? {}) as Record<string, unknown>, client)
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
}
