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
  if (
    typeof item.createdAt !== 'number' ||
    !Number.isFinite(item.createdAt) ||
    item.createdAt < 0 ||
    item.createdAt > 8.64e15
  ) {
    return false
  }

  // 互动字段可缺失（旧数据），但出现时类型必须正确，避免 NaN/字符串污染计数
  const { likes, liked, favorited } = item
  if (likes !== undefined && (typeof likes !== 'number' || !Number.isInteger(likes) || likes < 0)) {
    return false
  }
  if (liked !== undefined && typeof liked !== 'boolean') {
    return false
  }
  if (favorited !== undefined && typeof favorited !== 'boolean') {
    return false
  }

  return true
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
