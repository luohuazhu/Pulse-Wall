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
