/** 一条动态；createdAt 为毫秒时间戳 */
export interface Post {
  id: string
  content: string
  createdAt: number
  /** 点赞总数；旧数据可能缺失，UI 按 0 处理 */
  likes?: number
  /** 当前本地用户是否已点赞 */
  liked?: boolean
  /** 当前本地用户是否已收藏 */
  favorited?: boolean
}

/** 本地唯一作者，与原版保持一致 */
export interface Author {
  name: string
  initial: string
}

/** 从服务端/存储读到的原始条目：id 与互动字段可能缺失或非法 */
export interface PostLike {
  id?: unknown
  content: string
  createdAt: number
  likes?: unknown
  liked?: unknown
  favorited?: unknown
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
