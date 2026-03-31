import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    // Bundle corpus-core into main so packaged apps do not need extra node_modules.
    plugins: [
      externalizeDepsPlugin({
        exclude: ['@txn/corpus-core', '@txn/types']
      })
    ]
  },
  // Preload must be CJS: Electron loads it as a plain script, not an ES module.
  // Bundle @txn/* into the preload so packaged apps do not rely on require() resolving workspace deps.
  preload: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ['@txn/app-contracts', '@txn/types']
      })
    ],
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          inlineDynamicImports: true
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
