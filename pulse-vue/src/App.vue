<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PostComposer from './components/PostComposer.vue'
import SiteHeader from './components/SiteHeader.vue'
import Timeline from './components/Timeline.vue'
import { MESSAGES } from './constants'
import { usePostsStore } from './stores/posts'

const store = usePostsStore()
const timelineRef = ref<InstanceType<typeof Timeline> | null>(null)

function handlePublished(): void {
  timelineRef.value?.scrollToLatest()
}

onMounted(() => {
  void store.load()
})
</script>

<template>
  <div class="decor" aria-hidden="true">
    <span class="decor__blob decor__blob--green"></span>
    <span class="decor__blob decor__blob--blue"></span>
    <span class="decor__grid"></span>
  </div>

  <SiteHeader />

  <main class="app">
    <PostComposer @published="handlePublished" />
    <Timeline ref="timelineRef" />
  </main>

  <footer class="site-footer">
    <p>{{ MESSAGES.footer }}</p>
  </footer>
</template>
