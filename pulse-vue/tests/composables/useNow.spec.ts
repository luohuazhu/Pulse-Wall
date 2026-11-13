import { effectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useNow } from '../../src/composables/useNow'

afterEach(() => {
  vi.useRealTimers()
})

describe('useNow', () => {
  it('初始值来自注入的时钟', () => {
    const scope = effectScope()
    const now = scope.run(() => useNow({ clock: () => 1_000, interval: 0 }))

    expect(now?.value).toBe(1_000)
    scope.stop()
  })

  it('到达刷新间隔时更新为时钟当前值', () => {
    vi.useFakeTimers()
    let current = 1_000
    const scope = effectScope()
    const now = scope.run(() => useNow({ clock: () => current, interval: 5_000 }))

    current = 9_000
    vi.advanceTimersByTime(5_000)

    expect(now?.value).toBe(9_000)
    scope.stop()
  })

  it('作用域销毁后停止刷新，不泄漏定时器', () => {
    vi.useFakeTimers()
    let current = 1_000
    const scope = effectScope()
    const now = scope.run(() => useNow({ clock: () => current, interval: 5_000 }))

    scope.stop()
    current = 2_000
    vi.advanceTimersByTime(60_000)

    expect(now?.value).toBe(1_000)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('interval 为 0 时不创建定时器', () => {
    vi.useFakeTimers()
    const scope = effectScope()
    scope.run(() => useNow({ clock: () => 1_000, interval: 0 }))

    expect(vi.getTimerCount()).toBe(0)
    scope.stop()
  })
})
