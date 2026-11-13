import { serve } from '@hono/node-server'
import { createApp } from './app.ts'

const port = Number(process.env.PORT ?? 8787)
const app = createApp()

// 数据保存在内存中，进程退出即清空
serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, (info) => {
  console.log(`[pulse-api] listening on http://127.0.0.1:${info.port}`)
})
