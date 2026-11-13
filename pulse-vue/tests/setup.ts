import { afterEach, vi } from 'vitest'

// 组件测试运行在 jsdom，服务端测试运行在 node（无 window），这里保持环境无关
afterEach(() => {
  // vi.stubGlobal 不会被 restoreMocks 还原，必须显式清理
  vi.unstubAllGlobals()
})
