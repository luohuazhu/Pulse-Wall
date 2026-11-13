import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PostComposer from '../../src/components/PostComposer.vue'
import { MAX_LENGTH, MESSAGES } from '../../src/constants'
import { usePostsStore } from '../../src/stores/posts'
import type { Post } from '../../src/types'

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
  const store = usePostsStore()
  const wrapper = mount(PostComposer, {
    global: { plugins: [pinia] },
    attachTo: document.body,
  })
  mounted.push(wrapper)

  return {
    wrapper,
    store,
    input: wrapper.get('textarea'),
    button: wrapper.get('button[type="submit"]'),
    hint: () => wrapper.get('[role="status"]'),
    counter: () => wrapper.get('.counter'),
    submit: () => wrapper.get('form').trigger('submit'),
  }
}

beforeEach(() => {
  mounted = []
  fetchMock = vi.fn().mockResolvedValue(fakeResponse({ post: { id: 'srv-1', content: '动态', createdAt: Date.now() } }, 201))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  mounted.forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

describe('PostComposer · 计数与禁用态', () => {
  it('初始状态不可发布，计数从 0 开始', () => {
    const { button, counter, hint } = factory()

    expect(button.attributes('disabled')).toBeDefined()
    expect(counter().text()).toBe(`0/${MAX_LENGTH}`)
    expect(hint().text()).toBe('')
    expect(hint().classes()).not.toContain('is-visible')
  })

  it('输入内容后可以发布，计数实时更新', async () => {
    const { input, button, counter } = factory()

    await input.setValue('你好')

    expect(button.attributes('disabled')).toBeUndefined()
    expect(counter().text()).toBe(`2/${MAX_LENGTH}`)
  })

  it('仅输入空白字符时仍然不可发布', async () => {
    const { input, button } = factory()

    await input.setValue('    ')

    expect(button.attributes('disabled')).toBeDefined()
  })

  it('计数与上限使用同一基准：首尾空白不计入', async () => {
    const { input, counter } = factory()

    await input.setValue('  你好  ')

    expect(counter().text()).toBe(`2/${MAX_LENGTH}`)
  })

  it('超出上限时禁用发布并显示超限样式', async () => {
    const { input, button, counter } = factory()

    await input.setValue('a'.repeat(MAX_LENGTH + 1))

    expect(button.attributes('disabled')).toBeDefined()
    expect(counter().classes()).toContain('is-over')
  })

  it('删减回上限以内后恢复可发布状态', async () => {
    const { input, button, counter } = factory()

    await input.setValue('a'.repeat(MAX_LENGTH + 1))
    await input.setValue('a'.repeat(MAX_LENGTH))

    expect(button.attributes('disabled')).toBeUndefined()
    expect(counter().classes()).not.toContain('is-over')
  })
})

describe('PostComposer · 校验提示', () => {
  it('提交空内容时提示「写点什么再发布吧」且不请求服务端', async () => {
    const { submit, hint, store } = factory()

    await submit()
    await flushPromises()

    expect(hint().text()).toBe(MESSAGES.emptyContent)
    expect(hint().classes()).toContain('is-visible')
    expect(store.count).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('提交超长内容时提示字数上限', async () => {
    const { input, submit, hint } = factory()

    await input.setValue('a'.repeat(MAX_LENGTH + 1))
    await submit()
    await flushPromises()

    expect(hint().text()).toBe(MESSAGES.tooLong)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('再次编辑时清除提示', async () => {
    const { input, submit, hint } = factory()

    await submit()
    await flushPromises()
    expect(hint().text()).toBe(MESSAGES.emptyContent)

    await input.setValue('开始写作')
    expect(hint().text()).toBe('')
  })
})

describe('PostComposer · 发布流程', () => {
  it('发布成功后写入 store、清空输入并聚焦输入框', async () => {
    const created: Post = { id: 'srv-1', content: '第一条动态', createdAt: Date.now() }
    fetchMock.mockResolvedValueOnce(fakeResponse({ post: created }, 201))
    const { wrapper, input, button, submit, store, hint } = factory()

    await input.setValue('  第一条动态  ')
    await submit()
    await flushPromises()

    expect(store.count).toBe(1)
    expect(store.posts[0]).toEqual(created)
    expect((input.element as HTMLTextAreaElement).value).toBe('')
    expect(button.attributes('disabled')).toBeDefined()
    expect(hint().text()).toBe('')
    expect(document.activeElement).toBe(input.element)
    expect(wrapper.emitted('published')).toHaveLength(1)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/posts')
    expect(init.body).toBe(JSON.stringify({ content: '第一条动态' }))
  })

  it('同步到服务端失败时提示仅在本地临时显示', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const { input, submit, hint, store } = factory()

    await input.setValue('离线发布')
    await submit()
    await flushPromises()

    expect(store.count).toBe(1)
    expect(hint().text()).toBe(MESSAGES.persistFailed)
    expect(hint().classes()).toContain('is-visible')
  })

  it('请求进行中重复提交只会发送一次 POST', async () => {
    let resolveFetch!: (value: Response) => void
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => { resolveFetch = resolve }),
    )
    const { wrapper, input } = factory()

    await input.setValue('只发一次')
    void wrapper.get('form').trigger('submit')
    void wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveFetch(fakeResponse({ post: { id: 'srv-9', content: '只发一次', createdAt: Date.now() } }, 201))
    await flushPromises()
    expect(wrapper.emitted('published')).toHaveLength(1)
  })
})
