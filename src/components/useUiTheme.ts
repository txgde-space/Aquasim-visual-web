import { ref, watch, type Ref } from 'vue'
import { LOCAL_STORAGE_KEYS } from '../shared/constants'

export type UiTheme = 'dark' | 'light'

const theme: Ref<UiTheme> = ref('dark')

try {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.uiTheme)
  if (saved === 'dark' || saved === 'light') {
    theme.value = saved
  }
} catch {
  // ignore persistence errors
}

watch(
  theme,
  (value) => {
    document.documentElement.dataset.theme = value
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.uiTheme, value)
    } catch {
      // ignore persistence errors
    }
  },
  { immediate: true },
)

export function useUiTheme() {
  const toggleTheme = () => {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }
  return { theme, toggleTheme }
}
