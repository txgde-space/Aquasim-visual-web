<script setup lang="ts">
import { computed } from 'vue'
import { useUiTheme } from './components/useUiTheme'

const { theme, toggleTheme } = useUiTheme()

const themeToggleLabel = computed(() => (theme.value === 'dark' ? '切换到亮色主题' : '切换到暗色主题'))
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <router-link class="brand" to="/">
        <span class="brand-mark" aria-hidden="true"></span>
        <span class="brand-name">AQUASIM</span>
        <span class="brand-sub">水声网络仿真</span>
      </router-link>
      <nav class="page-tabs" aria-label="页面">
        <router-link class="page-tab" to="/">实验</router-link>
        <router-link class="page-tab" to="/replay">回放</router-link>
      </nav>
      <div class="topbar-actions">
        <button
          class="theme-toggle"
          type="button"
          :aria-label="themeToggleLabel"
          :title="themeToggleLabel"
          @click="toggleTheme"
        >
          <svg v-if="theme === 'dark'" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4 19 19M19 5l-1.6 1.6M6.6 17.4 5 19" />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.4 14.2A8.5 8.5 0 0 1 9.8 3.6a8.5 8.5 0 1 0 10.6 10.6Z" />
          </svg>
        </button>
      </div>
    </header>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>
