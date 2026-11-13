import type { Author } from './types'

/** 正文长度上限（服务端与前端保持一致） */
export const MAX_LENGTH = 280

/**
 * 输入框的 maxlength 放宽到 400：原生版即如此，
 * 保留这一差异才能走到「超出上限 -> 计数变红 + 禁用发布 + 专门提示」的交互路径。
 */
export const INPUT_MAX_LENGTH = 400

/** 相对时间的刷新间隔 */
export const TIME_REFRESH_MS = 60_000

export const AUTHOR: Author = { name: '本地用户', initial: '你' }

export const MESSAGES = {
  emptyContent: '写点什么再发布吧',
  tooLong: `内容超出 ${MAX_LENGTH} 字上限，请删减后再发布`,
  persistFailed: '保存到服务器失败，本条动态仅在本地临时显示',
  loadFailed: '无法连接服务器，时间线可能不是最新',
  emptyTitle: '这里还很安静',
  emptyText: '发布你的第一条动态，开始记录',
  timelineTitle: '时间线',
  timelineOrder: '最新在前',
  tagline: '动态墙 · 服务端存储',
  footer: 'Pulse · 数据保存在服务端内存中，服务重启后会清空',
} as const
