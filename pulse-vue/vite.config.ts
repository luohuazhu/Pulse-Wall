import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

const API_TARGET = 'http://127.0.0.1:8787'

// 开发与预览都把 /api 代理到 Hono，前端代码只依赖同源相对路径
const proxy = {
  '/api': {
    target: API_TARGET,
    changeOrigin: true,
  },
}

export default defineConfig({
  plugins: [vue()],
  server: { proxy },
  preview: { proxy },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.spec.ts'],
    restoreMocks: true,
  },
})
