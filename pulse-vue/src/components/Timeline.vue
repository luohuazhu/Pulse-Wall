<script setup lang="ts">
import { computed, ref } from 'vue'
import { MESSAGES } from '../constants'
import { useNow } from '../composables/useNow'
import { usePostsStore } from '../stores/posts'
import EmptyState from './EmptyState.vue'
import PostCard from './PostCard.vue'

const store = usePostsStore()
const now = useNow()
const feedEl = ref<HTMLElement | null>(null)
const onlyFavorites = ref(false)

const visiblePosts = computed(() =>
  onlyFavorites.value ? store.posts.filter((post) => post.favorited === true) : store.posts,
)

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
      <div class="timeline__tools">
        <span class="timeline__order">{{ MESSAGES.timelineOrder }}</span>
        <button
          type="button"
          class="timeline__filter"
          :class="{ 'is-active': onlyFavorites }"
          :aria-pressed="onlyFavorites ? 'true' : 'false'"
          @click="onlyFavorites = !onlyFavorites"
        >
          <svg class="timeline__filter-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z" stroke-linejoin="round" />
          </svg>
          {{ MESSAGES.filterFavorites }}
        </button>
      </div>
    </div>

    <p v-if="store.loadError" class="timeline__notice" role="alert">
      {{ MESSAGES.loadFailed }}
    </p>

    <EmptyState v-if="!store.hasPosts" />
    <EmptyState
      v-else-if="onlyFavorites && visiblePosts.length === 0"
      :title="MESSAGES.favoritesEmptyTitle"
      :text="MESSAGES.favoritesEmptyText"
    />

    <div ref="feedEl" class="feed" role="feed" :aria-busy="store.isLoading ? 'true' : 'false'">
      <PostCard
        v-for="post in visiblePosts"
        :key="post.id"
        :post="post"
        :now="now"
        :pending="store.isPending(post.id)"
        :error="store.errorTextFor(post.id)"
        @toggle-like="store.toggleLike"
        @toggle-favorite="store.toggleFavorite"
      />
    </div>
  </section>
</template>
