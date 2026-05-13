import { Command } from 'commander'

const ALL_COMMANDS = [
  'posts',
  'brands',
  'agents',
  'kb',
  'ideas',
  'clips',
  'carousels',
  'webhooks',
  'billing',
  'usage',
  'workspaces',
  'auth',
  'doctor',
  'whoami',
  'open',
  'update',
  'completion',
]

const SHELLS = ['bash', 'zsh', 'fish', 'pwsh'] as const
type Shell = (typeof SHELLS)[number]

const TEMPLATES: Record<Shell, (cmds: string[]) => string> = {
  bash: (cmds) => `# bash completion for ap / autoposting
# Add to ~/.bashrc or ~/.bash_profile:
#   source <(ap completion bash)
_ap_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local commands="${cmds.join(' ')}"
  COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
}
complete -F _ap_completions ap
complete -F _ap_completions autoposting
`,

  zsh: (cmds) => `# zsh completion for ap / autoposting
# Add to ~/.zshrc:
#   source <(ap completion zsh)
# Or append directly:
#   ap completion zsh >> ~/.zshrc
_ap() {
  compadd ${cmds.join(' ')}
}
compdef _ap ap autoposting
`,

  fish: (cmds) => `# fish completion for ap / autoposting
# Save to ~/.config/fish/completions/ap.fish or run:
#   ap completion fish | source
${cmds.map((c) => `complete -c ap -f -a '${c}'`).join('\n')}
${cmds.map((c) => `complete -c autoposting -f -a '${c}'`).join('\n')}
`,

  pwsh: (cmds) => `# PowerShell completion for ap / autoposting
# Add to your $PROFILE:
#   ap completion pwsh | Invoke-Expression
Register-ArgumentCompleter -Native -CommandName @('ap', 'autoposting') -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)
  $commands = @(${cmds.map((c) => `'${c}'`).join(', ')})
  $commands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
    [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
  }
}
`,
}

export function createCompletionCommand(): Command {
  return new Command('completion')
    .description(`Generate shell completion script. Shells: ${SHELLS.join(', ')}`)
    .argument('<shell>', `Shell type (${SHELLS.join('|')})`)
    .action((shell: string) => {
      if (!SHELLS.includes(shell as Shell)) {
        console.error(`Error: unsupported shell "${shell}". Supported: ${SHELLS.join(', ')}`)
        process.exit(1)
      }
      process.stdout.write(TEMPLATES[shell as Shell](ALL_COMMANDS))
    })
}
