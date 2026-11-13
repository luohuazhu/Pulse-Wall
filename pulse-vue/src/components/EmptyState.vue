<script setup lang="ts">
import { MESSAGES } from '../constants'

withDefaults(
  defineProps<{
    title?: string
    text?: string
  }>(),
  {
    title: MESSAGES.emptyTitle,
    text: MESSAGES.emptyText,
  },
)
</script>

<template>
  <div class="empty-state">
    <div class="empty-state__art" aria-hidden="true">
      <span class="bubble bubble--1"></span>
      <span class="bubble bubble--2"></span>
      <span class="bubble bubble--3"></span>
    </div>
    <p class="empty-state__title">{{ title }}</p>
    <p class="empty-state__text">{{ text }}</p>
  </div>
</template>
