import { defineConfig } from 'tsup'
import { version } from './package.json'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  outExtension: ({ format }) => ({ js: format === 'cjs' ? '.cjs' : '.mjs' }),
  dts: true,
  clean: true,
  sourcemap: true,
  // Bake the package.json version into the bundle so VERSION never drifts from the release.
  env: { AUTOPOSTING_SDK_VERSION: version },
})
