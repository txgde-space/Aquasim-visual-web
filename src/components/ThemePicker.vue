<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { THEME_PROFILES, type ThemeProfile } from '../features/canvas2d/lib/themes'

/** 画布主题选择器：调色板色条预览 + 名称，v-model 主题 key */
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [key: string] }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

const themeKeys = Object.keys(THEME_PROFILES)
const current = computed<ThemeProfile>(
  () => THEME_PROFILES[props.modelValue] ?? THEME_PROFILES['ocean-sonar'],
)

const prettyName = (key: string) =>
  key
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const swatchStyle = (profile: ThemeProfile) => ({
  background: `linear-gradient(${profile.tx}, ${profile.tx}) left bottom / 50% 2px no-repeat, linear-gradient(${profile.rx}, ${profile.rx}) right bottom / 50% 2px no-repeat, linear-gradient(135deg, ${profile.bg[0]}, ${profile.bg[1]}, ${profile.bg[2]})`,
})

const toggle = () => {
  open.value = !open.value
}

const select = (key: string) => {
  emit('update:modelValue', key)
  open.value = false
}

const onDocClick = (event: MouseEvent) => {
  if (root.value && !root.value.contains(event.target as Node)) {
    open.value = false
  }
}
const onDocKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    open.value = false
  }
}

watch(open, (value) => {
  if (value) {
    document.addEventListener('click', onDocClick, true)
    document.addEventListener('keydown', onDocKeydown)
  } else {
    document.removeEventListener('click', onDocClick, true)
    document.removeEventListener('keydown', onDocKeydown)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick, true)
  document.removeEventListener('keydown', onDocKeydown)
})
</script>

<template>
  <div ref="root" class="theme-picker">
    <button
      type="button"
      class="tp-trigger"
      aria-haspopup="listbox"
      :aria-expanded="open"
      title="画布主题"
      @click="toggle"
    >
      <span class="tp-swatch" :style="swatchStyle(current)"></span>
      <span class="tp-name">{{ prettyName(modelValue) }}</span>
      <svg class="tp-caret" :class="{ open }" viewBox="0 0 10 6" width="10" height="6" aria-hidden="true">
        <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </button>
    <ul v-if="open" class="tp-menu" role="listbox" aria-label="画布主题">
      <li v-for="key in themeKeys" :key="key" role="option" :aria-selected="key === modelValue">
        <button
          type="button"
          class="tp-option"
          :class="{ active: key === modelValue }"
          @click="select(key)"
        >
          <span class="tp-swatch" :style="swatchStyle(THEME_PROFILES[key])"></span>
          <span class="tp-name">{{ prettyName(key) }}</span>
          <svg
            v-if="key === modelValue"
            class="tp-check"
            viewBox="0 0 12 12"
            width="12"
            height="12"
            aria-hidden="true"
          >
            <path d="M2 6.5L5 9.5L10 2.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.theme-picker {
  position: relative;
}
.tp-trigger {
  display: flex;
  align-items: center;
  gap: 7px;
  height: var(--btn-compact-h);
  padding: 0 9px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: linear-gradient(var(--btn-top), var(--btn-bottom));
  color: var(--text);
  font-size: var(--meta-size);
  white-space: nowrap;
}
.tp-trigger:hover {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--line));
}
.tp-caret {
  color: var(--muted);
  transition: transform 0.15s ease;
}
.tp-caret.open {
  transform: rotate(180deg);
}
.tp-swatch {
  flex: none;
  width: 26px;
  height: 15px;
  border-radius: 3px;
  border: 1px solid var(--line);
}
.tp-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 6;
  min-width: 188px;
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--overlay);
  box-shadow: var(--shadow-pop);
}
.tp-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border-radius: 5px;
  color: var(--text);
  font-size: var(--meta-size);
  text-align: left;
}
.tp-option:hover {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}
.tp-option.active {
  color: var(--accent-soft);
}
.tp-option .tp-name {
  flex: 1;
}
.tp-check {
  flex: none;
  color: var(--accent);
}
</style>
