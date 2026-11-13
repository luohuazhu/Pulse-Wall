<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { AUTHOR, INPUT_MAX_LENGTH, MAX_LENGTH, MESSAGES } from '../constants'
import { usePostsStore } from '../stores/posts'

const emit = defineEmits<{ published: [] }>()

const store = usePostsStore()

const draft = ref('')
const hintText = ref('')
const isSubmitting = ref(false)
const inputEl = ref<HTMLTextAreaElement | null>(null)

const trimmedLength = computed(() => draft.value.trim().length)
const isOverLimit = computed(() => trimmedLength.value > MAX_LENGTH)
const canPublish = computed(() => trimmedLength.value > 0 && !isOverLimit.value)

function handleInput(): void {
  hintText.value = ''
}

function focusInput(): void {
  inputEl.value?.focus()
}

async function handleSubmit(): Promise<void> {
  if (isSubmitting.value) {
    return
  }

  isSubmitting.value = true
  try {
    const result = await store.addPost(draft.value)

    if (!result.ok) {
      hintText.value = result.code === 'TOO_LONG' ? MESSAGES.tooLong : MESSAGES.emptyContent
      focusInput()
      return
    }

    draft.value = ''
    hintText.value = result.persisted ? '' : MESSAGES.persistFailed
    focusInput()

    if (inputEl.value) {
      inputEl.value.scrollTop = 0
    }

    await nextTick()
    emit('published')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="composer" aria-label="发布动态">
    <form
      id="composer-form"
      class="composer__form"
      novalidate
      :aria-busy="isSubmitting ? 'true' : 'false'"
      @submit.prevent="handleSubmit"
    >
      <div class="composer__top">
        <span class="avatar avatar--me" aria-hidden="true">{{ AUTHOR.initial }}</span>
        <label class="sr-only" for="composer-input">动态内容</label>
        <textarea
          id="composer-input"
          ref="inputEl"
          v-model="draft"
          class="composer__input"
          rows="2"
          :maxlength="INPUT_MAX_LENGTH"
          placeholder="说点什么…"
          autocomplete="off"
          @input="handleInput"
        ></textarea>
      </div>
      <div class="composer__footer">
        <p class="composer__hint" :class="{ 'is-visible': hintText !== '' }" role="status" aria-live="polite">
          {{ hintText }}
        </p>
        <div class="composer__actions">
          <span class="counter" :class="{ 'is-over': isOverLimit }">
            <span class="char-used">{{ trimmedLength }}</span>/<span class="char-max">{{ MAX_LENGTH }}</span>
          </span>
          <button type="submit" class="btn-publish" :disabled="!canPublish || isSubmitting">
            <svg class="btn-publish__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 12.5 20 4l-5.5 16-3.2-6.3L4 12.5Z"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linejoin="round"
              />
            </svg>
            发布
          </button>
        </div>
      </div>
    </form>
  </section>
</template>
