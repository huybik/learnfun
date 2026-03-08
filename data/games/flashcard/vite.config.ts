import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@learnfun/game-sdk': path.resolve(__dirname, '../_sdk/src'),
    },
  },
})
