<script setup lang="ts">
import { computed } from 'vue'
import { AUTHOR, MESSAGES } from '../constants'
import type { Post } from '../types'
import { formatTime } from '../utils/time'

const props = defineProps<{
  post: Post
  /** 当前时间戳，由父级统一刷新，避免每条动态各挂一个定时器 */
  now: number
  /** 该动态有互动请求在途，按钮暂时禁用 */
  pending?: boolean
  /** 互动失败提示，null 表示无错误 */
  error?: string | null
}>()

const emit = defineEmits<{
  (event: 'toggle-like', id: string): void
  (event: 'toggle-favorite', id: string): void
}>()

const timeText = computed(() => formatTime(props.post.createdAt, props.now))
const dateTime = computed(() => new Date(props.post.createdAt).toISOString())
const liked = computed(() => props.post.liked === true)
const favorited = computed(() => props.post.favorited === true)
const likeCount = computed(() => props.post.likes ?? 0)
const likeLabel = computed(() =>
  likeCount.value > 0 ? `${MESSAGES.likeLabel}（${likeCount.value}）` : MESSAGES.likeLabel,
)
const favoriteLabel = computed(() =>
  favorited.value ? MESSAGES.unfavoriteLabel : MESSAGES.favoriteLabel,
)
</script>

<template>
  <article class="post" :data-id="post.id">
    <span class="avatar" aria-hidden="true">{{ AUTHOR.initial }}</span>
    <div class="post__body">
      <div class="post__head">
        <span class="post__name">{{ AUTHOR.name }}</span>
        <time class="post__time" :datetime="dateTime" :data-ts="post.createdAt">{{ timeText }}</time>
      </div>
      <p class="post__text">{{ post.content }}</p>

      <div class="post__actions">
        <button
          type="button"
          class="post__action post__action--like"
          :class="{ 'is-active': liked }"
          data-action="like"
          :aria-pressed="liked ? 'true' : 'false'"
          :aria-label="likeLabel"
          :aria-busy="pending ? 'true' : 'false'"
          :disabled="pending === true"
          @click="emit('toggle-like', post.id)"
        >
          <svg class="post__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M12 20.3s-7.5-4.6-7.5-9.6a4.2 4.2 0 0 1 7.5-2.5 4.2 4.2 0 0 1 7.5 2.5c0 5-7.5 9.6-7.5 9.6Z"
              stroke-linejoin="round"
            />
          </svg>
          <span class="post__count">{{ likeCount }}</span>
        </button>

        <button
          type="button"
          class="post__action post__action--favorite"
          :class="{ 'is-active': favorited }"
          data-action="favorite"
          :aria-pressed="favorited ? 'true' : 'false'"
          :aria-label="favoriteLabel"
          :aria-busy="pending ? 'true' : 'false'"
          :disabled="pending === true"
          @click="emit('toggle-favorite', post.id)"
        >
          <svg class="post__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z" stroke-linejoin="round" />
          </svg>
        </button>
      </div>

      <p v-if="error" class="post__action-error" role="alert">{{ error }}</p>
    </div>
  </article>
</template>
