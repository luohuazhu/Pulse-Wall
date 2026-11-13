import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PostCard from '../../src/components/PostCard.vue'
import type { Post } from '../../src/types'

const NOW = new Date(2024, 4, 20, 12, 0, 0).getTime()

function factory(post: Post, now = NOW) {
  return mount(PostCard, { props: { post, now } })
}

describe('PostCard', () => {
  it('渲染作者信息与正文', () => {
    const wrapper = factory({ id: 'p1', content: '今天天气不错', createdAt: NOW - 1000 })

    expect(wrapper.get('.post__name').text()).toBe('本地用户')
    expect(wrapper.get('.avatar').text()).toBe('你')
    expect(wrapper.get('.post__text').text()).toBe('今天天气不错')
    expect(wrapper.get('.post').attributes('data-id')).toBe('p1')
  })

  it('按传入的 now 计算相对时间', () => {
    const wrapper = factory({ id: 'p2', content: '五分钟前', createdAt: NOW - 5 * 60 * 1000 })

    expect(wrapper.get('time').text()).toBe('5 分钟前')
  })

  it('time 元素带 ISO 格式的 datetime', () => {
    const createdAt = NOW - 1000
    const wrapper = factory({ id: 'p3', content: '刚发的', createdAt })

    expect(wrapper.get('time').attributes('datetime')).toBe(new Date(createdAt).toISOString())
  })

  it('正文原样渲染，换行与类似标签的文本不会被解析', () => {
    const wrapper = factory({
      id: 'p4',
      content: '第一行\n第二行 <b>加粗</b>',
      createdAt: NOW,
    })
    const text = wrapper.get('.post__text')

    expect(text.text()).toContain('第一行\n第二行 <b>加粗</b>')
    expect(text.find('b').exists()).toBe(false)
    expect(text.html()).toContain('&lt;b&gt;')
  })
})

describe('PostCard · 点赞与收藏', () => {
  it('默认渲染 0 个赞、未点赞、未收藏', () => {
    const wrapper = factory({ id: 'p1', content: '动态', createdAt: NOW })

    const like = wrapper.get('[data-action="like"]')
    const favorite = wrapper.get('[data-action="favorite"]')

    expect(like.get('.post__count').text()).toBe('0')
    expect(like.attributes('aria-pressed')).toBe('false')
    expect(like.attributes('aria-label')).toBe('点赞')
    expect(favorite.attributes('aria-pressed')).toBe('false')
    expect(favorite.attributes('aria-label')).toBe('收藏')
  })

  it('已点赞/已收藏时高亮并更新无障碍状态', () => {
    const wrapper = factory({
      id: 'p2',
      content: '热门动态',
      createdAt: NOW,
      likes: 3,
      liked: true,
      favorited: true,
    })

    const like = wrapper.get('[data-action="like"]')
    const favorite = wrapper.get('[data-action="favorite"]')

    expect(like.classes()).toContain('is-active')
    expect(like.attributes('aria-pressed')).toBe('true')
    expect(like.get('.post__count').text()).toBe('3')
    expect(like.attributes('aria-label')).toBe('点赞（3）')
    expect(favorite.classes()).toContain('is-active')
    expect(favorite.attributes('aria-label')).toBe('取消收藏')
  })

  it('点击按钮向父级抛出动态 id', async () => {
    const wrapper = factory({ id: 'p3', content: '动态', createdAt: NOW })

    await wrapper.get('[data-action="like"]').trigger('click')
    await wrapper.get('[data-action="favorite"]').trigger('click')

    expect(wrapper.emitted('toggle-like')).toEqual([['p3']])
    expect(wrapper.emitted('toggle-favorite')).toEqual([['p3']])
  })

  it('请求在途时禁用按钮，失败提示通过 alert 播报', async () => {
    const wrapper = mount(PostCard, {
      props: {
        post: { id: 'p4', content: '动态', createdAt: NOW, likes: 1, liked: true },
        now: NOW,
        pending: true,
        error: '点赞失败，已恢复原状态',
      },
    })

    const like = wrapper.get('[data-action="like"]')
    expect(like.attributes('disabled')).toBeDefined()
    expect(like.attributes('aria-busy')).toBe('true')

    await like.trigger('click')
    expect(wrapper.emitted('toggle-like')).toBeUndefined()

    expect(wrapper.get('.post__action-error').attributes('role')).toBe('alert')
    expect(wrapper.get('.post__action-error').text()).toBe('点赞失败，已恢复原状态')
  })
})
