import { ref, watch, type Ref } from 'vue'
import { LOCAL_STORAGE_KEYS } from '../shared/constants'
import { THEME_PROFILES } from '../features/canvas2d/lib/themes'

const DEFAULT_CANVAS_THEME = 'research-lab'

// 画布主题跨页共享（实验页 / 回放页同一 key），模块级单例
const canvasTheme: Ref<string> = ref(DEFAULT_CANVAS_THEME)

try {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.canvasTheme)
  if (saved && saved in THEME_PROFILES) {
    canvasTheme.value = saved
  }
} catch {
  // ignore persistence errors
}

watch(canvasTheme, (value) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEYS.canvasTheme, value)
  } catch {
    // ignore persistence errors
  }
})

export function useCanvasTheme() {
  return { canvasTheme }
}
