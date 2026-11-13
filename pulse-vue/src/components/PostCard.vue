<script setup lang="ts">
import { computed } from 'vue'
import { AUTHOR } from '../constants'
import type { Post } from '../types'
import { formatTime } from '../utils/time'

const props = defineProps<{
  post: Post
  /** 当前时间戳，由父级统一刷新，避免每条动态各挂一个定时器 */
  now: number
}>()

const timeText = computed(() => formatTime(props.post.createdAt, props.now))
const dateTime = computed(() => new Date(props.post.createdAt).toISOString())
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
    </div>
  </article>
</template>
