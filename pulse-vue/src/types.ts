/** 一条动态；createdAt 为毫秒时间戳 */
export interface Post {
  id: string
  content: string
  createdAt: number
}

/** 本地唯一作者，与原版保持一致 */
export interface Author {
  name: string
  initial: string
}

/** 从本地存储读到的原始条目：id 可能缺失或非法 */
export interface PostLike {
  id?: unknown
  content: string
  createdAt: number
}

export type ContentErrorCode = 'EMPTY' | 'TOO_LONG'

export type ContentValidation =
  | { ok: true; content: string }
  | { ok: false; code: ContentErrorCode }

/** 发布结果：ok 表示是否入库，persisted 表示是否成功写入本地存储 */
export interface ComposeResult {
  ok: boolean
  code?: ContentErrorCode
  persisted: boolean
}
