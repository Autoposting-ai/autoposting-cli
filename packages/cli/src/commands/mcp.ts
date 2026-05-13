import { Command } from 'commander'

export function createMcpCommand(): Command {
  return new Command('mcp')
    .description('Start MCP stdio server for AI agent integration')
    .action(async () => {
      const { startMcpServer } = await import('../mcp/server.js')
      await startMcpServer()
    })
}
