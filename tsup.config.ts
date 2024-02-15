import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/retry.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  clean: true,
  treeshake: true,
  target: 'es2022',
  minify: 'terser',
})