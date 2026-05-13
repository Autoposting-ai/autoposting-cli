import { defineConfig } from 'tsup'
import fs from 'node:fs'
import path from 'node:path'

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['cjs'],
  outExtension: () => ({ js: '.cjs' }),
  clean: true,
  sourcemap: true,
  // esbuild banner only works for .js keys; for .cjs we prepend shebang via onSuccess
  async onSuccess() {
    const outFile = path.resolve('dist/cli.cjs')
    const content = fs.readFileSync(outFile, 'utf8')
    if (!content.startsWith('#!/usr/bin/env node')) {
      fs.writeFileSync(outFile, `#!/usr/bin/env node\n${content}`)
      fs.chmodSync(outFile, 0o755)
    }
  },
})
