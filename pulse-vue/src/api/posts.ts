import type { Post } from '../types'
import { isValidPost } from '../utils/validation'

export type PostsApiErrorCode =
  | 'EMPTY'
  | 'TOO_LONG'
  | 'INVALID_CONTENT'
  | 'INVALID_JSON'
  | 'NOT_FOUND'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'INTERNAL_ERROR'
  | 'HTTP_ERROR'
  | 'INVALID_RESPONSE'
  | 'NETWORK'

const SERVER_ERROR_CODES = [
  'EMPTY',
  'TOO_LONG',
  'INVALID_CONTENT',
  'INVALID_JSON',
  'NOT_FOUND',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'INTERNAL_ERROR',
] as const

/** 请求超时上限；避免服务端挂起时发布按钮永久禁用 */
const REQUEST_TIMEOUT_MS = 8_000

function timeoutSignal(): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    : undefined
}

/** 前端只区分「服务端拒绝」「网络不可达」「响应不可信」三类失败 */
export class PostsApiError extends Error {
  readonly code: PostsApiErrorCode
  readonly status: number

  constructor(code: PostsApiErrorCode, status: number, message: string) {
    super(message)
    this.name = 'PostsApiError'
    this.code = code
    this.status = status
  }
}

export interface PostsApi {
  /** 读取时间线（新 → 旧），非法条目会被丢弃 */
  list(): Promise<Post[]>
  /** 发布一条动态，内容已由调用方 trim */
  create(content: string): Promise<Post>
  /** 设置点赞状态（幂等），返回服务端最新动态 */
  setLiked(id: string, liked: boolean): Promise<Post>
  /** 设置收藏状态（幂等），返回服务端最新动态 */
  setFavorited(id: string, favorited: boolean): Promise<Post>
}

function normalizePost(value: unknown): Post | null {
  if (!isValidPost(value)) {
    return null
  }
  if (typeof value.id !== 'string' || value.id === '') {
    return null
  }
  return {
    id: value.id,
    content: value.content,
    createdAt: value.createdAt,
    // 互动字段是后加的，旧响应/旧数据可能缺失，统一补齐默认值
    likes: typeof value.likes === 'number' ? value.likes : 0,
    liked: value.liked === true,
    favorited: value.favorited === true,
  }
}

function pickErrorCode(value: unknown): PostsApiErrorCode | null {
  if (typeof value !== 'string') {
    return null
  }
  return (SERVER_ERROR_CODES as readonly string[]).includes(value)
    ? (value as PostsApiErrorCode)
    : null
}

function readError(body: unknown, status: number): { code: PostsApiErrorCode; message: string } {
  const error =
    body !== null && typeof body === 'object'
      ? (body as { error?: unknown }).error
      : undefined
  const detail =
    error !== null && typeof error === 'object'
      ? (error as { code?: unknown; message?: unknown })
      : undefined
  const message =
    typeof detail?.message === 'string' && detail.message !== ''
      ? detail.message
      : `请求失败（HTTP ${status}）`

  return { code: pickErrorCode(detail?.code) ?? 'HTTP_ERROR', message }
}

/**
 * 基于同源 /api 的 REST 客户端。
 * baseUrl 可注入，方便部署在子路径或测试环境。
 */
export function createPostsApi(baseUrl = ''): PostsApi {
  const endpoint = `${baseUrl}/api/posts`
  const postPath = (id: string): string => `${endpoint}/${encodeURIComponent(id)}`

  function readPost(body: unknown, status: number): Post {
    const post = normalizePost((body as { post?: unknown } | null)?.post)
    if (!post) {
      throw new PostsApiError('INVALID_RESPONSE', status, '响应格式不正确：缺少合法的 post')
    }
    return post
  }

  async function request(path: string, init?: RequestInit): Promise<unknown> {
    let response: Response
    try {
      response = await fetch(path, { ...init, signal: init?.signal ?? timeoutSignal() })
    } catch (error) {
      const message =
        (error as Error)?.name === 'TimeoutError' || (error as Error)?.name === 'AbortError'
          ? '请求超时，请稍后重试'
          : `无法连接服务器：${(error as Error).message}`
      throw new PostsApiError('NETWORK', 0, message)
    }

    let body: unknown
    try {
      body = await response.json()
    } catch {
      if (!response.ok) {
        const { message } = readError(null, response.status)
        throw new PostsApiError('HTTP_ERROR', response.status, message)
      }
      throw new PostsApiError('INVALID_RESPONSE', response.status, '服务器返回了无法解析的响应')
    }

    if (!response.ok) {
      const { code, message } = readError(body, response.status)
      throw new PostsApiError(code, response.status, message)
    }

    return body
  }

  return {
    async list() {
      const body = await request(endpoint)
      const posts = (body as { posts?: unknown } | null)?.posts
      if (!Array.isArray(posts)) {
        throw new PostsApiError('INVALID_RESPONSE', 200, '响应格式不正确：缺少 posts 数组')
      }

      return posts
        .map(normalizePost)
        .filter((post): post is Post => post !== null)
        .sort((a, b) => b.createdAt - a.createdAt)
    },

    async create(content) {
      const body = await request(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      return readPost(body, 201)
    },

    async setLiked(id, liked) {
      const body = await request(`${postPath(id)}/like`, { method: liked ? 'PUT' : 'DELETE' })
      return readPost(body, 200)
    },

    async setFavorited(id, favorited) {
      const body = await request(`${postPath(id)}/favorite`, {
        method: favorited ? 'PUT' : 'DELETE',
      })
      return readPost(body, 200)
    },
  }
}
