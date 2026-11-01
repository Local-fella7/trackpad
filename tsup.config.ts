import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['electron/main.ts', 'electron/preload.ts'],
  outDir: 'dist-electron',
  format: ['cjs'],
  target: 'node20',
  external: ['electron', 'better-sqlite3'],
  clean: true,
})
