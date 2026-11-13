<script setup lang="ts">
import { ref } from 'vue'
import { MESSAGES } from '../constants'
import { useNow } from '../composables/useNow'
import { usePostsStore } from '../stores/posts'
import EmptyState from './EmptyState.vue'
import PostCard from './PostCard.vue'

const store = usePostsStore()
const now = useNow()
const feedEl = ref<HTMLElement | null>(null)

/** 发布成功后由 App 调用，把最新一条滚动到可视区域 */
function scrollToLatest(): void {
  const first = feedEl.value?.firstElementChild
  if (first instanceof HTMLElement && typeof first.scrollIntoView === 'function') {
    first.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

defineExpose({ scrollToLatest })
</script>

<template>
  <section class="timeline" aria-label="动态时间线">
    <div class="timeline__meta">
      <h2 class="timeline__title">{{ MESSAGES.timelineTitle }}</h2>
      <span class="timeline__order">{{ MESSAGES.timelineOrder }}</span>
    </div>

    <p v-if="store.loadError" class="timeline__notice" role="alert">
      {{ MESSAGES.loadFailed }}
    </p>

    <EmptyState v-if="!store.hasPosts" />

    <div ref="feedEl" class="feed" role="feed" :aria-busy="store.isLoading ? 'true' : 'false'">
      <PostCard v-for="post in store.posts" :key="post.id" :post="post" :now="now" />
    </div>
  </section>
</template>
