import { afterEach, describe, expect, it, vi } from 'vitest'
import { createId } from '../../src/utils/id'

afterEach(() => {
  vi.useRealTimers()
})

describe('createId', () => {
  it('返回非空字符串', () => {
    const id = createId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('以当前时间戳的 36 进制作为前缀', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 4, 20, 12, 0, 0))

    expect(createId().startsWith(Date.now().toString(36))).toBe(true)
  })

  it('同一毫秒内多次生成不重复', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 4, 20, 12, 0, 0))

    const ids = new Set(Array.from({ length: 500 }, () => createId()))
    expect(ids.size).toBe(500)
  })
})
