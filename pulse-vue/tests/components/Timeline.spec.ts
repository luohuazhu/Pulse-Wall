import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Timeline from '../../src/components/Timeline.vue'
import { MESSAGES } from '../../src/constants'
import { usePostsStore } from '../../src/stores/posts'
import type { Post } from '../../src/types'

const NOW = Date.now()
const posts: Post[] = [
  { id: 'b', content: '较新', createdAt: NOW },
  { id: 'a', content: '较旧', createdAt: NOW - 60_000 },
]

let mounted: VueWrapper[] = []

function factory() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = usePostsStore()
  const wrapper = mount(Timeline, { global: { plugins: [pinia] } })
  mounted.push(wrapper)
  return { wrapper, store }
}

beforeEach(() => {
  mounted = []
})

afterEach(() => {
  mounted.forEach((wrapper) => wrapper.unmount())
})

describe('Timeline', () => {
  it('没有动态时展示空状态', () => {
    const { wrapper } = factory()

    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.text()).toContain(MESSAGES.emptyTitle)
    expect(wrapper.text()).toContain(MESSAGES.emptyText)
    expect(wrapper.findAll('.post')).toHaveLength(0)
  })

  it('有动态时隐藏空状态并按 store 顺序渲染', async () => {
    const { wrapper, store } = factory()
    store.posts = posts
    await wrapper.vm.$nextTick()

    const rendered = wrapper.findAll('.post')

    expect(wrapper.find('.empty-state').exists()).toBe(false)
    expect(rendered.map((node) => node.attributes('data-id'))).toEqual(['b', 'a'])
  })

  it('feed 容器保留可访问性属性，并随加载状态切换 aria-busy', async () => {
    const { wrapper, store } = factory()
    expect(wrapper.get('.feed').attributes('role')).toBe('feed')
    expect(wrapper.get('.feed').attributes('aria-busy')).toBe('false')

    store.isLoading = true
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.feed').attributes('aria-busy')).toBe('true')

    store.isLoading = false
    store.posts = posts
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.feed').attributes('aria-busy')).toBe('false')
    expect(wrapper.get('.feed').attributes('role')).toBe('feed')
  })

  it('加载失败时展示提示', async () => {
    const { wrapper, store } = factory()
    store.loadError = true
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[role="alert"]').text()).toBe(MESSAGES.loadFailed)
  })

  it('展示时间线标题与排序说明', () => {
    const { wrapper } = factory()

    expect(wrapper.get('.timeline__title').text()).toBe(MESSAGES.timelineTitle)
    expect(wrapper.get('.timeline__order').text()).toBe(MESSAGES.timelineOrder)
  })
})

describe('Timeline · 收藏筛选与互动', () => {
  const favoritedPost: Post = {
    id: 'fav',
    content: '收藏过的动态',
    createdAt: NOW,
    likes: 1,
    liked: true,
    favorited: true,
  }
  const plainPost: Post = {
    id: 'plain',
    content: '普通动态',
    createdAt: NOW - 60_000,
    likes: 0,
    liked: false,
    favorited: false,
  }

  it('开启「只看收藏」后只渲染已收藏动态', async () => {
    const { wrapper, store } = factory()
    store.posts = [favoritedPost, plainPost]
    await wrapper.vm.$nextTick()

    const filter = wrapper.get('.timeline__filter')
    expect(filter.attributes('aria-pressed')).toBe('false')

    await filter.trigger('click')

    expect(filter.attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('.post').map((node) => node.attributes('data-id'))).toEqual(['fav'])
  })

  it('有动态但无收藏时展示收藏空状态', async () => {
    const { wrapper, store } = factory()
    store.posts = [plainPost]
    await wrapper.vm.$nextTick()

    await wrapper.get('.timeline__filter').trigger('click')

    expect(wrapper.findAll('.post')).toHaveLength(0)
    expect(wrapper.text()).toContain(MESSAGES.favoritesEmptyTitle)
    expect(wrapper.text()).toContain(MESSAGES.favoritesEmptyText)
    expect(wrapper.text()).not.toContain(MESSAGES.emptyTitle)
  })

  it('互动失败提示只出现在对应动态卡片内', async () => {
    const { wrapper, store } = factory()
    store.posts = [favoritedPost, plainPost]
    store.interactionError = { id: 'fav', kind: 'favorite' }
    await wrapper.vm.$nextTick()

    const cards = wrapper.findAll('.post')
    const favCard = cards.find((card) => card.attributes('data-id') === 'fav')!
    const plainCard = cards.find((card) => card.attributes('data-id') === 'plain')!

    expect(favCard.get('[role="alert"]').text()).toBe(MESSAGES.favoriteFailed)
    expect(plainCard.find('[role="alert"]').exists()).toBe(false)
  })

  it('点击点赞按钮调用 store.toggleLike 并传入 id', async () => {
    const { wrapper, store } = factory()
    // Pinia action 会在渲染时被模板捕获，必须先 stub 再触发渲染
    const toggle = vi.spyOn(store, 'toggleLike').mockResolvedValue(true)
    store.posts = [plainPost]
    await wrapper.vm.$nextTick()

    await wrapper.get('[data-action="like"]').trigger('click')

    expect(toggle).toHaveBeenCalledWith('plain')
  })
})
