import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { createPostsApi } from '../api/posts'
import type { ComposeResult, Post } from '../types'
import { createId } from '../utils/id'
import { validateContent } from '../utils/validation'

/**
 * 动态列表的单一数据源：内存态始终「新 → 旧」。
 * 数据来自 /api/posts（服务端内存存储），视图只读 state/getter，改动统一走 action。
 */
export const usePostsStore = defineStore('posts', () => {
  const api = createPostsApi()

  const posts = ref<Post[]>([])
  /** 最近一次发布是否只在本地可见（服务端同步失败） */
  const persistError = ref(false)
  /** 最近一次加载是否失败 */
  const loadError = ref(false)
  const isLoading = ref(false)

  /** 请求序号：让先发后到的旧列表响应失效，避免覆盖更新的数据 */
  let loadSequence = 0
  /** 已成功创建但可能不在某个旧列表响应里的条目 id，用于合并而不是丢弃 */
  const recentlyCreated = new Set<string>()

  const count = computed(() => posts.value.length)
  const hasPosts = computed(() => posts.value.length > 0)

  /** 从服务端载入；失败时保留旧列表并标记 loadError */
  async function load(): Promise<void> {
    const sequence = ++loadSequence
    isLoading.value = true
    loadError.value = false

    try {
      const list = await api.list()
      if (sequence !== loadSequence) {
        return
      }

      // 旧响应可能早于某次发布，保留服务端已有动态里暂时缺失的新条目
      const pending = posts.value.filter(
        (post) => recentlyCreated.has(post.id) && !list.some((item) => item.id === post.id),
      )
      posts.value = [...pending, ...list].sort((a, b) => b.createdAt - a.createdAt)

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
        { id: createId(), content: validation.content, createdAt: Date.now() },
        ...posts.value,
      ]
      persistError.value = true
      return { ok: true, persisted: false }
    }
  }

  return {
    posts,
    persistError,
    loadError,
    isLoading,
    count,
    hasPosts,
    load,
    addPost,
  }
})
