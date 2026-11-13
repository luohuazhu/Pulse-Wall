import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App.vue'
import { MESSAGES } from '../../src/constants'
import { usePostsStore } from '../../src/stores/posts'
import type { Post } from '../../src/types'

const NOW = Date.now()
const stored: Post[] = [
  { id: 'a', content: '更早的动态', createdAt: NOW - 120_000 },
  { id: 'b', content: '更新的动态', createdAt: NOW - 60_000 },
]

function fakeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

let mounted: VueWrapper[] = []
let fetchMock: ReturnType<typeof vi.fn>

function factory() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(App, { global: { plugins: [pinia] }, attachTo: document.body })
  mounted.push(wrapper)
  return { wrapper, store: usePostsStore() }
}

beforeEach(() => {
  mounted = []
  fetchMock = vi.fn().mockResolvedValue(fakeResponse({ posts: [] }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  mounted.forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

describe('App', () => {
  it('挂载后从服务端载入并按倒序渲染', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ posts: stored }))
    const { wrapper } = factory()
    await flushPromises()

    expect(wrapper.get('[data-testid="post-count"]').text()).toBe('2 条动态')
    expect(wrapper.findAll('.post').map((node) => node.attributes('data-id'))).toEqual(['b', 'a'])
    expect(wrapper.find('.empty-state').exists()).toBe(false)
  })

  it('没有数据时展示空状态与零条动态', async () => {
    const { wrapper } = factory()
    await flushPromises()

    expect(wrapper.get('[data-testid="post-count"]').text()).toBe('0 条动态')
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.text()).toContain(MESSAGES.emptyTitle)
  })

  it('发布后向服务端发送 POST，新动态出现在时间线顶部', async () => {
    const created: Post = { id: 'srv-1', content: '集成测试发布', createdAt: NOW }
    fetchMock
      .mockResolvedValueOnce(fakeResponse({ posts: [] }))
      .mockResolvedValueOnce(fakeResponse({ post: created }, 201))
    const { wrapper } = factory()
    await flushPromises()

    await wrapper.get('textarea').setValue('集成测试发布')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    const rendered = wrapper.findAll('.post')
    expect(rendered).toHaveLength(1)
    expect(rendered[0]?.get('.post__text').text()).toBe('集成测试发布')
    expect(rendered[0]?.attributes('data-id')).toBe('srv-1')
    expect(wrapper.get('[data-testid="post-count"]').text()).toBe('1 条动态')
    expect(wrapper.find('.empty-state').exists()).toBe(false)

    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ content: '集成测试发布' }))
  })

  it('加载失败时展示提示且页面不崩溃', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const { wrapper } = factory()
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe(MESSAGES.loadFailed)
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.get('[data-testid="post-count"]').text()).toBe('0 条动态')
  })

  it('挂载时只请求一次列表接口', async () => {
    factory()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/posts')
  })

  it('点赞成功：请求 PUT 子资源并更新计数', async () => {
    const target: Post = {
      id: 'b',
      content: '可点赞的动态',
      createdAt: NOW,
      likes: 0,
      liked: false,
      favorited: false,
    }
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return Promise.resolve(fakeResponse({ post: { ...target, likes: 1, liked: true } }))
      }
      return Promise.resolve(fakeResponse({ posts: [target] }))
    })
    const { wrapper } = factory()
    await flushPromises()

    await wrapper.get('[data-action="like"]').trigger('click')
    await flushPromises()

    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(url).toBe('/api/posts/b/like')
    expect(init.method).toBe('PUT')
    expect(wrapper.get('.post__count').text()).toBe('1')
    expect(wrapper.get('[data-testid="post-count"]').text()).toBe('1 条动态')
  })

  it('点赞失败：回滚计数并展示错误提示', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const target: Post = {
      id: 'b',
      content: '会失败的动态',
      createdAt: NOW,
      likes: 0,
      liked: false,
      favorited: false,
    }
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return Promise.reject(new TypeError('Failed to fetch'))
      }
      return Promise.resolve(fakeResponse({ posts: [target] }))
    })
    const { wrapper } = factory()
    await flushPromises()

    await wrapper.get('[data-action="like"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('.post__count').text()).toBe('0')
    expect(wrapper.get('.post__action-error').text()).toBe(MESSAGES.likeFailed)
  })
})
