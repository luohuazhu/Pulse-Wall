import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPostsApi, PostsApiError } from '../../src/api/posts'
import type { Post } from '../../src/types'

const older: Post = { id: 'older', content: '更早的动态', createdAt: 1_700_000_000_000 }
const newer: Post = { id: 'newer', content: '更新的动态', createdAt: 1_700_000_100_000 }

/** 只实现 api 客户端真正用到的 Response 字段，避免依赖 jsdom 是否提供 Response */
function fakeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

function brokenJsonResponse(status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new SyntaxError('Unexpected token <')
    },
  } as unknown as Response
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

describe('createPostsApi · list', () => {
  it('请求 /api/posts 并返回按时间倒序的列表', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ posts: [older, newer] }))
    const api = createPostsApi()

    const posts = await api.list()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/posts')
    expect(posts.map((post) => post.id)).toEqual(['newer', 'older'])
  })

  it('过滤缺少 id 或结构非法的条目，保留合法条目', async () => {
    fetchMock.mockResolvedValue(
      fakeResponse({
        posts: [older, { content: '没有 id', createdAt: 2 }, { content: '', createdAt: 2 }, null, 42],
      }),
    )
    const api = createPostsApi()

    expect(await api.list()).toEqual([older])
  })

  it('HTTP 错误时抛出带状态码与错误码的 PostsApiError', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ error: { code: 'NOT_FOUND', message: '接口不存在' } }, 404))
    const api = createPostsApi()

    const error = await api.list().catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(PostsApiError)
    expect((error as PostsApiError).code).toBe('NOT_FOUND')
    expect((error as PostsApiError).status).toBe(404)
  })

  it('错误响应没有错误码时兜底为 HTTP_ERROR', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ message: 'oops' }, 500))
    const api = createPostsApi()

    await expect(api.list()).rejects.toMatchObject({ code: 'HTTP_ERROR', status: 500 })
  })

  it('响应不是 JSON（例如代理回退到 index.html）时抛出 INVALID_RESPONSE', async () => {
    fetchMock.mockResolvedValue(brokenJsonResponse())
    const api = createPostsApi()

    await expect(api.list()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('posts 不是数组时抛出 INVALID_RESPONSE', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ posts: { older } }))
    const api = createPostsApi()

    await expect(api.list()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('网络异常转换为 NETWORK 错误', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const api = createPostsApi()

    const error = await api.list().catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(PostsApiError)
    expect((error as PostsApiError).code).toBe('NETWORK')
    expect((error as PostsApiError).status).toBe(0)
  })

  it('请求携带超时信号，超时被转换为可读的 NETWORK 错误', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ posts: [] }))
    const api = createPostsApi()
    await api.list()

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.signal).toBeInstanceOf(AbortSignal)

    const timeout = new Error('The operation was aborted')
    timeout.name = 'TimeoutError'
    fetchMock.mockRejectedValueOnce(timeout)

    const error = await api.list().catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(PostsApiError)
    expect((error as PostsApiError).code).toBe('NETWORK')
    expect((error as PostsApiError).message).toContain('超时')
  })
})

describe('createPostsApi · create', () => {
  it('POST JSON 请求体并返回服务端生成的动态', async () => {
    const created: Post = { id: 'srv-1', content: '你好', createdAt: 1_700_000_200_000 }
    fetchMock.mockResolvedValue(fakeResponse({ post: created }, 201))
    const api = createPostsApi()

    const post = await api.create('你好')

    expect(post).toEqual(created)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ content: '你好' }))
    expect(new Headers(init.headers).get('content-type')).toContain('application/json')
  })

  it('校验错误码从响应体透传', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ error: { code: 'TOO_LONG', message: '超长' } }, 400))
    const api = createPostsApi()

    await expect(api.create('a'.repeat(281))).rejects.toMatchObject({ code: 'TOO_LONG', status: 400 })
  })

  it('响应中的 post 结构非法时抛出 INVALID_RESPONSE', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ post: { content: '缺少 id 与时间' } }, 201))
    const api = createPostsApi()

    await expect(api.create('你好')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('成功状态码但响应不是 JSON 时抛出 INVALID_RESPONSE', async () => {
    fetchMock.mockResolvedValue(brokenJsonResponse(201))
    const api = createPostsApi()

    await expect(api.create('你好')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
})
