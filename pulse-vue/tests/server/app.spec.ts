// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../../server/app.ts'
import { createMemoryPostRepository, type PostRepository } from '../../server/store.ts'

type ErrorBody = { error: { code: string; message: string } }

function createHarness(repository: PostRepository = createMemoryPostRepository()) {
  return { repository, app: createApp({ repository }) }
}

describe('GET /api/posts', () => {
  it('空仓库返回 200 与空列表', async () => {
    const { app } = createHarness()

    const response = await app.request('/api/posts')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({ posts: [] })
  })

  it('返回仓库数据并按时间倒序', async () => {
    const times = [100, 300, 200]
    let index = 0
    const repository = createMemoryPostRepository({
      now: () => times[index++] ?? 0,
      createId: () => `p${index}`,
    })
    repository.create('最早')
    repository.create('最新')
    repository.create('居中')
    const { app } = createHarness(repository)

    const body = (await (await app.request('/api/posts')).json()) as { posts: { content: string }[] }

    expect(body.posts.map((post) => post.content)).toEqual(['最新', '居中', '最早'])
  })
})

describe('POST /api/posts · 成功路径', () => {
  it('创建成功返回 201，服务端生成 id/createdAt 并去除首尾空白', async () => {
    const repository = createMemoryPostRepository({ now: () => 1_700_000_000_000 })
    const { app } = createHarness(repository)

    const response = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '  你好，Pulse  ' }),
    })
    const body = (await response.json()) as { post: { id: string; content: string; createdAt: number } }

    expect(response.status).toBe(201)
    expect(body.post.content).toBe('你好，Pulse')
    expect(body.post.createdAt).toBe(1_700_000_000_000)
    expect(typeof body.post.id).toBe('string')
    expect(body.post.id.length).toBeGreaterThan(0)
    expect(body.post).toMatchObject({ likes: 0, liked: false, favorited: false })

    const list = (await (await app.request('/api/posts')).json()) as { posts: unknown[] }
    expect(list.posts).toHaveLength(1)
  })

  it('恰好 280 字可发布，且长度按 trim 后计算', async () => {
    const { app } = createHarness()

    const exact = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'a'.repeat(280) }),
    })
    const padded = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: `${'a'.repeat(280)}   ` }),
    })

    expect(exact.status).toBe(201)
    expect(padded.status).toBe(201)
    const body = (await padded.json()) as { post: { content: string } }
    expect(body.post.content).toHaveLength(280)
  })
})

describe('POST /api/posts · 校验失败', () => {
  it('空字符串返回 400 EMPTY 且不写入', async () => {
    const repository = createMemoryPostRepository()
    const { app } = createHarness(repository)

    const response = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '' }),
    })
    const body = (await response.json()) as ErrorBody

    expect(response.status).toBe(400)
    expect(body.error.code).toBe('EMPTY')
    expect(body.error.message.length).toBeGreaterThan(0)
    expect(repository.list()).toEqual([])
  })

  it('全空白字符返回 400 EMPTY', async () => {
    const { app } = createHarness()

    const response = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '  \n\t  ' }),
    })

    expect(response.status).toBe(400)
    expect(((await response.json()) as ErrorBody).error.code).toBe('EMPTY')
  })

  it('281 字返回 400 TOO_LONG 且不写入', async () => {
    const repository = createMemoryPostRepository()
    const { app } = createHarness(repository)

    const response = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'a'.repeat(281) }),
    })

    expect(response.status).toBe(400)
    expect(((await response.json()) as ErrorBody).error.code).toBe('TOO_LONG')
    expect(repository.list()).toEqual([])
  })
})

describe('POST /api/posts · 请求体异常', () => {
  it.each([
    ['数字', 123],
    ['null', null],
    ['布尔', true],
    ['数组', ['a']],
    ['对象', {}],
  ])('content 非字符串（%s）返回 400 INVALID_CONTENT', async (_label, content) => {
    const { app } = createHarness()

    const response = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content }),
    })

    expect(response.status).toBe(400)
    expect(((await response.json()) as ErrorBody).error.code).toBe('INVALID_CONTENT')
  })

  it('缺少 content 字段返回 400 INVALID_CONTENT', async () => {
    const { app } = createHarness()

    const response = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })

    expect(response.status).toBe(400)
    expect(((await response.json()) as ErrorBody).error.code).toBe('INVALID_CONTENT')
  })

  it('非法 JSON 返回 400 INVALID_JSON', async () => {
    const { app } = createHarness()

    const response = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{broken',
    })

    expect(response.status).toBe(400)
    expect(((await response.json()) as ErrorBody).error.code).toBe('INVALID_JSON')
  })

  it('空 body 返回 400 INVALID_JSON', async () => {
    const { app } = createHarness()

    const response = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })

    expect(response.status).toBe(400)
    expect(((await response.json()) as ErrorBody).error.code).toBe('INVALID_JSON')
  })

  it('非 application/json 的 Content-Type 返回 415', async () => {
    const { app } = createHarness()

    const response = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: '{"content":"跨站表单"}',
    })

    expect(response.status).toBe(415)
    expect(((await response.json()) as ErrorBody).error.code).toBe('UNSUPPORTED_MEDIA_TYPE')
  })

  it('超过 8KB 的请求体返回 413 且不写入', async () => {
    const repository = createMemoryPostRepository()
    const { app } = createHarness(repository)

    const response = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'a'.repeat(9_000) }),
    })

    expect(response.status).toBe(413)
    expect(((await response.json()) as ErrorBody).error.code).toBe('PAYLOAD_TOO_LARGE')
    expect(repository.list()).toEqual([])
  })
})

describe('PUT/DELETE /api/posts/:id · 点赞与收藏', () => {
  function seededRepository() {
    let id = 0
    const repository = createMemoryPostRepository({
      now: () => 1_700_000_000_000,
      createId: () => `p${++id}`,
    })
    const post = repository.create('目标动态')
    return { repository, post }
  }

  it('PUT like 返回 200 的完整动态，GET 列表同步可读', async () => {
    const { repository, post } = seededRepository()
    const { app } = createHarness(repository)

    const response = await app.request(`/api/posts/${post.id}/like`, { method: 'PUT' })
    const body = (await response.json()) as { post: { likes: number; liked: boolean } }

    expect(response.status).toBe(200)
    expect(body.post).toMatchObject({ likes: 1, liked: true, favorited: false })

    const list = (await (await app.request('/api/posts')).json()) as {
      posts: { likes: number; liked: boolean }[]
    }
    expect(list.posts[0]).toMatchObject({ likes: 1, liked: true })
  })

  it('重复 PUT like 幂等', async () => {
    const { repository, post } = seededRepository()
    const { app } = createHarness(repository)

    const first = (await (await app.request(`/api/posts/${post.id}/like`, { method: 'PUT' })).json()) as {
      post: { likes: number }
    }
    const second = (await (await app.request(`/api/posts/${post.id}/like`, { method: 'PUT' })).json()) as {
      post: { likes: number }
    }

    expect(first.post.likes).toBe(1)
    expect(second.post.likes).toBe(1)
  })

  it('DELETE like 与重复 DELETE 不会减成负数', async () => {
    const { repository, post } = seededRepository()
    const { app } = createHarness(repository)

    await app.request(`/api/posts/${post.id}/like`, { method: 'PUT' })
    await app.request(`/api/posts/${post.id}/like`, { method: 'DELETE' })
    const response = await app.request(`/api/posts/${post.id}/like`, { method: 'DELETE' })
    const body = (await response.json()) as { post: { likes: number; liked: boolean } }

    expect(body.post).toMatchObject({ likes: 0, liked: false })
  })

  it('收藏 PUT/DELETE 幂等，且不影响点赞计数', async () => {
    const { repository, post } = seededRepository()
    const { app } = createHarness(repository)
    const url = `/api/posts/${post.id}/favorite`

    const on = (await (await app.request(url, { method: 'PUT' })).json()) as {
      post: { favorited: boolean; likes: number }
    }
    const onAgain = (await (await app.request(url, { method: 'PUT' })).json()) as {
      post: { favorited: boolean }
    }
    const off = (await (await app.request(url, { method: 'DELETE' })).json()) as {
      post: { favorited: boolean }
    }
    const onFinal = (await (await app.request(url, { method: 'PUT' })).json()) as {
      post: { favorited: boolean; likes: number }
    }

    expect(on.post).toMatchObject({ favorited: true, likes: 0 })
    expect(onAgain.post.favorited).toBe(true)
    expect(off.post.favorited).toBe(false)
    expect(onFinal.post).toMatchObject({ favorited: true, likes: 0 })
  })

  it('未知 id 的四个端点都返回 404 且不新建条目', async () => {
    const { repository } = seededRepository()
    const { app } = createHarness(repository)
    const before = repository.list()

    const cases = [
      ['/api/posts/missing/like', 'PUT'],
      ['/api/posts/missing/like', 'DELETE'],
      ['/api/posts/missing/favorite', 'PUT'],
      ['/api/posts/missing/favorite', 'DELETE'],
    ] as const

    for (const [path, method] of cases) {
      const response = await app.request(path, { method })
      const body = (await response.json()) as ErrorBody

      expect(response.status).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
      expect(body.error.message).toBe('动态不存在')
    }

    expect(repository.list()).toEqual(before)
  })

  it('无请求体、无 Content-Type 的 PUT 也能成功（不触发 413/415）', async () => {
    const { repository, post } = seededRepository()
    const { app } = createHarness(repository)

    const response = await app.request(`/api/posts/${post.id}/favorite`, { method: 'PUT' })

    expect(response.status).toBe(200)
  })
})

describe('路由与错误形状', () => {
  it('未知 API 路由返回 404 NOT_FOUND', async () => {
    const { app } = createHarness()

    for (const path of ['/api/unknown', '/api/posts/123']) {
      const response = await app.request(path)
      const body = (await response.json()) as ErrorBody

      expect(response.status).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
      expect(typeof body.error.message).toBe('string')
      expect(body.error.message.length).toBeGreaterThan(0)
    }
  })

  it('未捕获异常返回统一 JSON 500 且不泄漏堆栈', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const brokenRepository: PostRepository = {
      list() {
        throw new Error('boom at store.ts:42')
      },
      create() {
        throw new Error('boom at store.ts:42')
      },
      like() {
        throw new Error('boom at store.ts:42')
      },
      unlike() {
        throw new Error('boom at store.ts:42')
      },
      favorite() {
        throw new Error('boom at store.ts:42')
      },
      unfavorite() {
        throw new Error('boom at store.ts:42')
      },
    }
    const { app } = createHarness(brokenRepository)

    const response = await app.request('/api/posts')
    const body = (await response.json()) as ErrorBody

    expect(response.status).toBe(500)
    expect(body.error).toEqual({ code: 'INTERNAL_ERROR', message: '服务器内部错误' })
    expect(error).toHaveBeenCalled()
  })

  it('健康检查可用', async () => {
    const { app } = createHarness()

    const response = await app.request('/api/health')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('不同 app 实例的数据互不影响', async () => {
    const a = createHarness()
    const b = createHarness()

    await a.app.request('/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '只属于 a' }),
    })

    const listA = (await (await a.app.request('/api/posts')).json()) as { posts: unknown[] }
    const listB = (await (await b.app.request('/api/posts')).json()) as { posts: unknown[] }
    expect(listA.posts).toHaveLength(1)
    expect(listB.posts).toEqual([])
  })
})
