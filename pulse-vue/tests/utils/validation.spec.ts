import { describe, expect, it } from 'vitest'
import { MAX_LENGTH } from '../../src/constants'
import { isValidPost, validateContent } from '../../src/utils/validation'

describe('validateContent', () => {
  it('空内容返回 EMPTY', () => {
    expect(validateContent('')).toEqual({ ok: false, code: 'EMPTY' })
  })

  it('仅空白字符返回 EMPTY', () => {
    expect(validateContent('   \n\t ')).toEqual({ ok: false, code: 'EMPTY' })
  })

  it('合法内容返回去除首尾空白后的正文', () => {
    expect(validateContent('  今天天气不错  ')).toEqual({ ok: true, content: '今天天气不错' })
  })

  it('恰好达到上限时允许发布', () => {
    const content = 'a'.repeat(MAX_LENGTH)
    expect(validateContent(content)).toEqual({ ok: true, content })
  })

  it('超过上限时返回 TOO_LONG', () => {
    expect(validateContent('a'.repeat(MAX_LENGTH + 1))).toEqual({ ok: false, code: 'TOO_LONG' })
  })

  it('长度按去除首尾空白后计算', () => {
    const content = 'a'.repeat(MAX_LENGTH) + '   '
    expect(validateContent(content)).toEqual({ ok: true, content: 'a'.repeat(MAX_LENGTH) })
  })
})

describe('isValidPost', () => {
  const valid = { id: 'a1', content: '你好', createdAt: 1716158400000 }

  it('合法对象返回 true', () => {
    expect(isValidPost(valid)).toBe(true)
  })

  it('缺少 id 时仍然视为内容合法', () => {
    expect(isValidPost({ content: '你好', createdAt: 1716158400000 })).toBe(true)
  })

  it.each([
    ['null', null],
    ['字符串', 'abc'],
    ['数组', []],
    ['缺少 content', { createdAt: 1 }],
    ['content 非字符串', { content: 123, createdAt: 1 }],
    ['content 全是空白', { content: '   ', createdAt: 1 }],
    ['createdAt 非数字', { content: '你好', createdAt: '1' }],
    ['createdAt 是 NaN', { content: '你好', createdAt: Number.NaN }],
    ['createdAt 是 Infinity', { content: '你好', createdAt: Number.POSITIVE_INFINITY }],
    ['createdAt 超出 Date 上限', { content: '你好', createdAt: 1e300 }],
    ['createdAt 为负数', { content: '你好', createdAt: -1 }],
    ['likes 为负数', { content: '你好', createdAt: 1, likes: -1 }],
    ['likes 非整数', { content: '你好', createdAt: 1, likes: 1.5 }],
    ['likes 非数字', { content: '你好', createdAt: 1, likes: '2' }],
    ['liked 非布尔', { content: '你好', createdAt: 1, liked: 'yes' }],
    ['favorited 非布尔', { content: '你好', createdAt: 1, favorited: 1 }],
  ])('非法结构返回 false: %s', (_label, value) => {
    expect(isValidPost(value)).toBe(false)
  })

  it('携带合法互动字段时返回 true', () => {
    expect(isValidPost({ ...valid, likes: 3, liked: true, favorited: false })).toBe(true)
  })
})
