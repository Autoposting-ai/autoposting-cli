import { Command } from 'commander'

export function createMcpCommand(): Command {
  return new Command('mcp')
    .description('Start MCP stdio server for AI agent integration')
    .action(async (_options, command: Command) => {
      try {
        const { startMcpServer } = await import('../mcp/server.js')
        await startMcpServer(command.optsWithGlobals<{ apiKey?: string }>())
      } catch (error) {
        console.error(error instanceof Error ? error.message : 'Unable to start MCP server.')
        process.exitCode = (error as { exitCode?: number }).exitCode ?? 1
      }
    })
}
