import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { Autoposting } from '@autoposting.ai/sdk'
import { ALL_TOOLS } from './tools.js'
import { handleToolCall } from './handler.js'

export async function startMcpServer(): Promise<void> {
  const client = new Autoposting() // reads AUTOPOSTING_API_KEY from env

  const server = new Server(
    { name: 'autoposting-mcp', version: '0.1.0' },
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
