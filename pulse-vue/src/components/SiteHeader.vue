<script setup lang="ts">
import { MESSAGES } from '../constants'
import { usePostsStore } from '../stores/posts'

const store = usePostsStore()
</script>

<template>
  <header class="site-header">
    <div class="site-header__inner">
      <div class="brand">
        <span class="brand__mark" aria-hidden="true"><span class="brand__dot"></span></span>
        <div class="brand__text">
          <h1 class="brand__name">Pulse</h1>
          <p class="brand__tagline">{{ MESSAGES.tagline }}</p>
        </div>
      </div>
      <div class="count-chip">
        <span class="count-chip__dot" aria-hidden="true"></span>
        <span data-testid="post-count">{{ store.count }} 条动态</span>
      </div>
    </div>
  </header>
</template>
