import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { createPostsApi } from '../api/posts'
import { MESSAGES } from '../constants'
import type { ComposeResult, Post } from '../types'
import { createId } from '../utils/id'
import { validateContent } from '../utils/validation'

export type InteractionKind = 'like' | 'favorite'

export interface InteractionError {
  id: string
  kind: InteractionKind
}

interface PostInteraction {
  likes: number
  liked: boolean
  favorited: boolean
}

function interactionOf(post: Post): PostInteraction {
  return {
    likes: post.likes ?? 0,
    liked: post.liked === true,
    favorited: post.favorited === true,
  }
}

/**
 * 动态列表的单一数据源：内存态始终「新 → 旧」。
 * 数据来自 /api/posts（服务端内存存储），视图只读 state/getter，改动统一走 action。
 */
export const usePostsStore = defineStore('posts', () => {
  const api = createPostsApi()

  const posts = ref<Post[]>([])
  /** 最近一次发布是否只在本地可见（服务端同步失败） */
  const persistError = ref(false)
  /** 最近一次互动是否失败（用于卡片内提示） */
  const interactionError = ref<InteractionError | null>(null)
  /** 最近一次加载是否失败 */
  const loadError = ref(false)
  const isLoading = ref(false)
  /** 正在请求中的动态 id，用于忽略重复点击 */
  const pending = ref(new Set<string>())

  /** 请求序号：让先发后到的旧列表响应失效，避免覆盖更新的数据 */
  let loadSequence = 0
  /** 互动序号：记录每帖最后一次本地互动的时刻，load 合并时保护更新的本地状态 */
  let interactionSequence = 0
  const interactionStamps = new Map<string, number>()
  /** 已成功创建但可能不在某个旧列表响应里的条目 id，用于合并而不是丢弃 */
  const recentlyCreated = new Set<string>()

  const count = computed(() => posts.value.length)
  const hasPosts = computed(() => posts.value.length > 0)

  function isPending(id: string): boolean {
    return pending.value.has(id)
  }

  function errorTextFor(id: string): string | null {
    const current = interactionError.value
    if (!current || current.id !== id) {
      return null
    }
    return current.kind === 'like' ? MESSAGES.likeFailed : MESSAGES.favoriteFailed
  }

  /** 只更新互动三字段，保留可能已被刷新覆盖的 content/createdAt */
  function applyInteraction(id: string, next: PostInteraction): void {
    const index = posts.value.findIndex((post) => post.id === id)
    if (index === -1) {
      return
    }
    posts.value[index] = { ...posts.value[index]!, ...next }
  }

  /** 从服务端载入；失败时保留旧列表并标记 loadError */
  async function load(): Promise<void> {
    const sequence = ++loadSequence
    const stampAtStart = interactionSequence
    isLoading.value = true
    loadError.value = false

    try {
      const list = await api.list()
      if (sequence !== loadSequence) {
        return
      }

      // 旧响应可能早于某次发布，保留服务端已有动态里暂时缺失的新条目
      const pendingCreates = posts.value.filter(
        (post) => recentlyCreated.has(post.id) && !list.some((item) => item.id === post.id),
      )
      const merged = [...pendingCreates, ...list].map((post) => {
        const local = posts.value.find((item) => item.id === post.id)
        const stamp = interactionStamps.get(post.id)
        // 本轮 load 期间的互动、或仍在途的互动，都比列表响应更新，保留本地值
        const keepLocal =
          local !== undefined &&
          (pending.value.has(post.id) || (stamp !== undefined && stamp > stampAtStart))
        return keepLocal ? { ...post, ...interactionOf(local) } : post
      })
      posts.value = merged.sort((a, b) => b.createdAt - a.createdAt)

      for (const post of list) {
        recentlyCreated.delete(post.id)
      }
    } catch (error) {
      if (sequence !== loadSequence) {
        return
      }
      console.warn('[Pulse] 加载动态失败:', error)
      loadError.value = true
    } finally {
      if (sequence === loadSequence) {
        isLoading.value = false
      }
    }
  }

  /** 发布一条动态，返回是否入库以及是否成功同步到服务端 */
  async function addPost(rawContent: string): Promise<ComposeResult> {
    const validation = validateContent(rawContent)
    if (!validation.ok) {
      return { ok: false, code: validation.code, persisted: false }
    }

    try {
      const post = await api.create(validation.content)
      posts.value = [post, ...posts.value]
      recentlyCreated.add(post.id)
      persistError.value = false
      return { ok: true, persisted: true }
    } catch (error) {
      console.warn('[Pulse] 保存到服务器失败，改为本地临时展示:', error)
      // 服务端不可用时仍让用户看到自己的内容，下次 load 会被服务端数据覆盖
      posts.value = [
        {
          id: createId(),
          content: validation.content,
          createdAt: Date.now(),
          likes: 0,
          liked: false,
          favorited: false,
        },
        ...posts.value,
      ]
      persistError.value = true
      return { ok: true, persisted: false }
    }
  }

  /** 点赞开关：先乐观更新，失败回滚并提示 */
  async function toggleLike(id: string): Promise<boolean> {
    if (pending.value.has(id)) {
      return false
    }
    const current = posts.value.find((post) => post.id === id)
    if (!current) {
      return false
    }

    const before = interactionOf(current)
    const next: PostInteraction = {
      ...before,
      liked: !before.liked,
      likes: Math.max(0, before.likes + (before.liked ? -1 : 1)),
    }

    pending.value.add(id)
    interactionStamps.set(id, ++interactionSequence)
    if (interactionError.value?.id === id) {
      interactionError.value = null
    }
    applyInteraction(id, next)

    try {
      const updated = await api.setLiked(id, next.liked)
      applyInteraction(id, interactionOf(updated))
      interactionError.value = null
      return true
    } catch (error) {
      console.warn('[Pulse] 点赞失败，已回滚:', error)
      applyInteraction(id, before)
      interactionError.value = { id, kind: 'like' }
      return false
    } finally {
      pending.value.delete(id)
    }
  }

  /** 收藏开关：先乐观更新，失败回滚并提示 */
  async function toggleFavorite(id: string): Promise<boolean> {
    if (pending.value.has(id)) {
      return false
    }
    const current = posts.value.find((post) => post.id === id)
    if (!current) {
      return false
    }

    const before = interactionOf(current)
    const next: PostInteraction = { ...before, favorited: !before.favorited }

    pending.value.add(id)
    interactionStamps.set(id, ++interactionSequence)
    if (interactionError.value?.id === id) {
      interactionError.value = null
    }
    applyInteraction(id, next)

    try {
      const updated = await api.setFavorited(id, next.favorited)
      applyInteraction(id, interactionOf(updated))
      interactionError.value = null
      return true
    } catch (error) {
      console.warn('[Pulse] 收藏失败，已回滚:', error)
      applyInteraction(id, before)
      interactionError.value = { id, kind: 'favorite' }
      return false
    } finally {
      pending.value.delete(id)
    }
  }

  return {
    posts,
    persistError,
    interactionError,
    loadError,
    isLoading,
    count,
    hasPosts,
    isPending,
    errorTextFor,
    load,
    addPost,
    toggleLike,
    toggleFavorite,
  }
})
