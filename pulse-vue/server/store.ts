import type { Post } from '../src/types'

/** 仓库只负责存取，不做内容校验（校验在 HTTP 层完成） */
export interface PostRepository {
  list(): Post[]
  create(content: string): Post
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

  return {
    list() {
      // 返回副本，避免调用方直接改动内部数组
      return [...posts].sort((a, b) => b.createdAt - a.createdAt)
    },

    create(content: string) {
      const post: Post = { id: createId(), content, createdAt: now() }
      posts.push(post)
      return post
    },
  }
}
