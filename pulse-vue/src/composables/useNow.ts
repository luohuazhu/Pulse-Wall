import { onScopeDispose, ref } from 'vue'
import type { Ref } from 'vue'
import { TIME_REFRESH_MS } from '../constants'

export interface UseNowOptions {
  /** 刷新间隔（毫秒），<= 0 表示不自动刷新 */
  interval?: number
  /** 时钟实现，测试中可注入假时钟 */
  clock?: () => number
}

/**
 * 提供随时间自动更新的时间戳，用于相对时间展示。
 * 定时器随所在 effect scope 销毁，不会泄漏。
 */
export function useNow(options: UseNowOptions = {}): Ref<number> {
  const { interval = TIME_REFRESH_MS, clock = Date.now } = options
  const now = ref(clock())

  if (interval > 0) {
    const timer = setInterval(() => {
      now.value = clock()
    }, interval)

    onScopeDispose(() => clearInterval(timer))
  }

  return now
}
