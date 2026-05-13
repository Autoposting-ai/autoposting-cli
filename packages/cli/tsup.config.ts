import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['cjs'],
  clean: true,
  sourcemap: true,
  banner: { js: '#!/usr/bin/env node' },
})
