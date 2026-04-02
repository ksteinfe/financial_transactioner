import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ['@txn/corpus-core', '@txn/types']
      })
    ]
  },
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
    plugins: [react()],
    test: {
      environment: 'jsdom',
      globals: true
    }
  }
})
