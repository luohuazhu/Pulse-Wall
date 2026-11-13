import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { validateContent } from '../src/utils/validation.ts'
import {
  createMemoryPostRepository,
  type InteractionResult,
  type PostRepository,
} from './store.ts'

export type ApiErrorCode =
  | 'EMPTY'
  | 'TOO_LONG'
  | 'INVALID_CONTENT'
  | 'INVALID_JSON'
  | 'NOT_FOUND'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'INTERNAL_ERROR'

const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  EMPTY: '内容不能为空',
  TOO_LONG: '内容超出 280 字上限',
  INVALID_CONTENT: '请求体必须包含字符串类型的 content 字段',
  INVALID_JSON: '请求体必须是合法的 JSON',
  NOT_FOUND: '接口不存在',
  PAYLOAD_TOO_LARGE: '请求体过大',
  UNSUPPORTED_MEDIA_TYPE: '请求体必须是 application/json',
  INTERNAL_ERROR: '服务器内部错误',
}

/** 280 字中文最多约 1KB，8KB 足够且能挡住超大请求体 */
const MAX_BODY_BYTES = 8 * 1024

/** 动态不存在与路由不存在语义不同，单独给文案 */
const POST_NOT_FOUND_MESSAGE = '动态不存在'

function interactionHandler(action: (id: string) => InteractionResult) {
  return (c: Context) => {
    const result = action(c.req.param('id') ?? '')
    if (!result.ok) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: POST_NOT_FOUND_MESSAGE } },
        404,
      )
    }
    return c.json({ post: result.post })
  }
}

export interface AppOptions {
  repository?: PostRepository
}

/**
 * 组装 Hono 应用。repository 可注入，便于测试与将来替换持久化实现。
 */
export function createApp(options: AppOptions = {}): Hono {
  const repository = options.repository ?? createMemoryPostRepository()
  const app = new Hono()

  app.get('/api/health', (c) => c.json({ ok: true }))

  app.get('/api/posts', (c) => c.json({ posts: repository.list() }))

  app.post(
    '/api/posts',
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) =>
        c.json(
          {
            error: {
              code: 'PAYLOAD_TOO_LARGE',
              message: ERROR_MESSAGES.PAYLOAD_TOO_LARGE,
            },
          },
          413,
        ),
    }),
    async (c) => {
      if (!c.req.header('content-type')?.includes('application/json')) {
        return c.json(
          {
            error: {
              code: 'UNSUPPORTED_MEDIA_TYPE',
              message: ERROR_MESSAGES.UNSUPPORTED_MEDIA_TYPE,
            },
          },
          415,
        )
      }

      let body: unknown
      try {
        body = await c.req.json()
      } catch {
        return c.json(
          { error: { code: 'INVALID_JSON', message: ERROR_MESSAGES.INVALID_JSON } },
          400,
        )
      }

      if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        return c.json(
          { error: { code: 'INVALID_CONTENT', message: ERROR_MESSAGES.INVALID_CONTENT } },
          400,
        )
      }

      const content = (body as Record<string, unknown>).content
      if (typeof content !== 'string') {
        return c.json(
          { error: { code: 'INVALID_CONTENT', message: ERROR_MESSAGES.INVALID_CONTENT } },
          400,
        )
      }

      const validation = validateContent(content)
      if (!validation.ok) {
        return c.json(
          { error: { code: validation.code, message: ERROR_MESSAGES[validation.code] } },
          400,
        )
      }

      return c.json({ post: repository.create(validation.content) }, 201)
    },
  )

  // 幂等的点赞/收藏：PUT 置为已赞/已收藏，DELETE 取消
  app.put('/api/posts/:id/like', interactionHandler((id) => repository.like(id)))
  app.delete('/api/posts/:id/like', interactionHandler((id) => repository.unlike(id)))
  app.put('/api/posts/:id/favorite', interactionHandler((id) => repository.favorite(id)))
  app.delete('/api/posts/:id/favorite', interactionHandler((id) => repository.unfavorite(id)))

  app.notFound((c) =>
    c.json({ error: { code: 'NOT_FOUND', message: ERROR_MESSAGES.NOT_FOUND } }, 404),
  )

  app.onError((error, c) => {
    console.error('[pulse-api] 未捕获异常:', error)
    return c.json(
      { error: { code: 'INTERNAL_ERROR', message: ERROR_MESSAGES.INTERNAL_ERROR } },
      500,
    )
  })

  return app
}
