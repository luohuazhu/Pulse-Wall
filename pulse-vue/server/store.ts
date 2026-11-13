import type { Post } from '../src/types'

/** 互动操作结果：ok=false 表示动态不存在，不做任何写入 */
export type InteractionResult = { ok: true; post: Post } | { ok: false }

/** 仓库只负责存取，不做内容校验（校验在 HTTP 层完成） */
export interface PostRepository {
  list(): Post[]
  create(content: string): Post
  like(id: string): InteractionResult
  unlike(id: string): InteractionResult
  favorite(id: string): InteractionResult
  unfavorite(id: string): InteractionResult
}

export interface RepositoryDeps {
  now?: () => number
  createId?: () => string
}

let sequence = 0

function defaultCreateId(): string {
  sequence = (sequence + 1) % 1_000_000
  const random = Math.random().toString(36).slice(2, 8)
  return `${Date.now().toString(36)}${random}${sequence.toString(36)}`
}

/**
 * 进程内内存仓库：数据只存在于当前 Node 进程，重启即清空。
 * 工厂 + 依赖注入让测试可以固定时钟与 id，并保证实例之间互不影响。
 */
export function createMemoryPostRepository(deps: RepositoryDeps = {}): PostRepository {
  const now = deps.now ?? (() => Date.now())
  const createId = deps.createId ?? defaultCreateId
  const posts: Post[] = []

  function find(id: string): Post | undefined {
    return posts.find((post) => post.id === id)
  }

  function snapshot(post: Post): InteractionResult {
    return { ok: true, post: { ...post } }
  }

  return {
    list() {
      // 数组与元素都返回副本，避免调用方直接改动仓库内部状态
      return posts.map((post) => ({ ...post })).sort((a, b) => b.createdAt - a.createdAt)
    },

    create(content: string) {
      const post: Post = {
        id: createId(),
        content,
        createdAt: now(),
        likes: 0,
        liked: false,
        favorited: false,
      }
      posts.push(post)
      return { ...post }
    },

    like(id) {
      const post = find(id)
      if (!post) {
        return { ok: false }
      }
      // 幂等：已点赞时不重复累加
      if (post.liked !== true) {
        post.likes = (post.likes ?? 0) + 1
        post.liked = true
      }
      return snapshot(post)
    },

    unlike(id) {
      const post = find(id)
      if (!post) {
        return { ok: false }
      }
      // 幂等：未点赞时不重复递减，计数永不为负
      if (post.liked === true) {
        post.likes = Math.max(0, (post.likes ?? 0) - 1)
        post.liked = false
      }
      return snapshot(post)
    },

    favorite(id) {
      const post = find(id)
      if (!post) {
        return { ok: false }
      }
      post.favorited = true
      return snapshot(post)
    },

    unfavorite(id) {
      const post = find(id)
      if (!post) {
        return { ok: false }
      }
      post.favorited = false
      return snapshot(post)
    },
  }
}
