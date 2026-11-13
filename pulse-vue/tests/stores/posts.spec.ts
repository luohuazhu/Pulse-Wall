import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_LENGTH } from '../../src/constants'
import { usePostsStore } from '../../src/stores/posts'
import type { Post } from '../../src/types'

const NOW = new Date(2024, 4, 20, 12, 0, 0).getTime()

const older: Post = { id: 'older', content: '更早的动态', createdAt: NOW - 120_000 }
const newer: Post = { id: 'newer', content: '更新的动态', createdAt: NOW - 60_000 }

function fakeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  fetchMock = vi.fn().mockResolvedValue(fakeResponse({ posts: [] }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('posts store · 初始与加载', () => {
  it('初始状态为空且无错误', () => {
    const store = usePostsStore()

    expect(store.posts).toEqual([])
    expect(store.count).toBe(0)
    expect(store.hasPosts).toBe(false)
    expect(store.persistError).toBe(false)
    expect(store.loadError).toBe(false)
    expect(store.isLoading).toBe(false)
  })

  it('load 从服务端读取并保持倒序', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ posts: [older, newer] }))
    const store = usePostsStore()

    await store.load()

    expect(store.posts.map((post) => post.id)).toEqual(['newer', 'older'])
    expect(store.count).toBe(2)
    expect(store.hasPosts).toBe(true)
    expect(store.loadError).toBe(false)
    expect(store.isLoading).toBe(false)
  })

  it('load 失败时安全降级并标记 loadError', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const store = usePostsStore()

    await expect(store.load()).resolves.toBeUndefined()
    expect(store.posts).toEqual([])
    expect(store.loadError).toBe(true)
    expect(store.isLoading).toBe(false)
  })

  it('刷新失败时保留已有列表', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const store = usePostsStore()
    fetchMock.mockResolvedValueOnce(fakeResponse({ posts: [older] }))
    await store.load()

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await store.load()

    expect(store.posts).toEqual([older])
    expect(store.loadError).toBe(true)
  })
})

describe('posts store · addPost', () => {
  it('空内容返回 EMPTY 且不请求服务端', async () => {
    const store = usePostsStore()
    await store.load()
    fetchMock.mockClear()

    const result = await store.addPost('   ')

    expect(result).toEqual({ ok: false, code: 'EMPTY', persisted: false })
    expect(store.posts).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('超长内容返回 TOO_LONG 且不请求服务端', async () => {
    const store = usePostsStore()
    await store.load()
    fetchMock.mockClear()

    const result = await store.addPost('a'.repeat(MAX_LENGTH + 1))

    expect(result).toEqual({ ok: false, code: 'TOO_LONG', persisted: false })
    expect(store.posts).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('服务端创建成功时以服务端返回的数据插入顶部', async () => {
    const store = usePostsStore()
    const created: Post = { id: 'srv-1', content: '新的动态', createdAt: NOW }
    fetchMock.mockResolvedValueOnce(fakeResponse({ posts: [older] }))
    await store.load()
    fetchMock.mockClear()
    fetchMock.mockResolvedValueOnce(fakeResponse({ post: created }, 201))

    const result = await store.addPost('  新的动态  ')

    expect(result).toEqual({ ok: true, persisted: true })
    expect(store.posts.map((post) => post.id)).toEqual(['srv-1', 'older'])
    expect(store.posts[0]).toEqual(created)
    expect(store.persistError).toBe(false)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ content: '新的动态' }))
  })

  it('服务端失败时乐观插入本地条目并标记 persistError', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    fetchMock.mockResolvedValue(fakeResponse({ posts: [] }))
    const store = usePostsStore()
    await store.load()
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const result = await store.addPost('离线发布')

    expect(result).toEqual({ ok: true, persisted: false })
    expect(store.posts).toHaveLength(1)
    expect(store.posts[0]?.content).toBe('离线发布')
    expect(store.posts[0]?.createdAt).toBe(NOW)
    expect(typeof store.posts[0]?.id).toBe('string')
    expect(store.persistError).toBe(true)
  })

  it('下一次同步成功后 persistError 复位', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    fetchMock.mockResolvedValue(fakeResponse({ posts: [] }))
    const store = usePostsStore()
    await store.load()

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await store.addPost('第一条')
    expect(store.persistError).toBe(true)

    fetchMock.mockResolvedValueOnce(
      fakeResponse({ post: { id: 'srv-2', content: '第二条', createdAt: NOW } }, 201),
    )
    await store.addPost('第二条')
    expect(store.persistError).toBe(false)
  })

  it('发布成功不会被仍在途的旧列表响应覆盖', async () => {
    let resolveList!: (value: Response) => void
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => { resolveList = resolve }),
    )
    const created: Post = { id: 'srv-1', content: '刚发布', createdAt: NOW }
    const store = usePostsStore()

    const loading = store.load()
    fetchMock.mockResolvedValueOnce(fakeResponse({ post: created }, 201))
    await store.addPost('刚发布')

    resolveList(fakeResponse({ posts: [] }))
    await loading

    expect(store.posts.map((post) => post.id)).toEqual(['srv-1'])
    expect(store.isLoading).toBe(false)
  })

  it('先发后到的旧 load 不会覆盖较新的列表', async () => {
    let resolveFirst!: (value: Response) => void
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => { resolveFirst = resolve }),
    )
    const store = usePostsStore()

    const first = store.load()
    fetchMock.mockResolvedValueOnce(fakeResponse({ posts: [newer] }))
    const second = store.load()
    await second

    resolveFirst(fakeResponse({ posts: [older] }))
    await first

    expect(store.posts.map((post) => post.id)).toEqual(['newer'])
    expect(store.isLoading).toBe(false)
  })

  it('重新 load 后以服务端数据为准，临时条目被覆盖', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    fetchMock.mockResolvedValue(fakeResponse({ posts: [] }))
    const store = usePostsStore()
    await store.load()
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await store.addPost('临时条目')

    fetchMock.mockResolvedValueOnce(fakeResponse({ posts: [older, newer] }))
    await store.load()

    expect(store.posts.map((post) => post.id)).toEqual(['newer', 'older'])
    expect(store.loadError).toBe(false)
  })
})
