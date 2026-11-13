import { MAX_LENGTH } from '../constants.ts'
import type { ContentValidation, PostLike } from '../types'

/** 结构校验：content 需为非空字符串，createdAt 需为有限数字 */
export function isValidPost(value: unknown): value is PostLike {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const item = value as Record<string, unknown>
  if (typeof item.content !== 'string' || item.content.trim() === '') {
    return false
  }

  // 上限 8.64e15 是 Date 可表示的最大时间戳，越界会让 toISOString() 抛 RangeError
  return (
    typeof item.createdAt === 'number' &&
    Number.isFinite(item.createdAt) &&
    item.createdAt >= 0 &&
    item.createdAt <= 8.64e15
  )
}

/** 正文校验：返回去除首尾空白后的内容，或错误码 */
export function validateContent(raw: string): ContentValidation {
  const content = raw.trim()

  if (content === '') {
    return { ok: false, code: 'EMPTY' }
  }
  if (content.length > MAX_LENGTH) {
    return { ok: false, code: 'TOO_LONG' }
  }

  return { ok: true, content }
}
