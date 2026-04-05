import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/php': 'http://localhost:8001'
    }
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    env: {
      VITE_IMAGESERVER: 'https://example.com/imageserver'
    }
  }
})
