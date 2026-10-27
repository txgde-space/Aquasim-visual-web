<script setup lang="ts">
import { onErrorCaptured, onMounted } from 'vue'
import { useSceneLoader } from './lib/useSceneLoader'

defineOptions({ inheritAttrs: false })
defineProps({ active: { type: Boolean, default: true } })

const sceneLoader = useSceneLoader(() => import('./NodeScene3D.vue').then((module) => module.default))
const { component, error, load, reportError } = sceneLoader

onMounted(load)
onErrorCaptured((cause) => {
  reportError(cause)
  return false
})

const reloadPage = () => window.location.reload()
</script>

<template>
  <div class="scene-loader">
    <component
      :is="component"
      v-if="component && !error"
      v-bind="$attrs"
      :active="active"
      @scene-error="reportError"
    />
    <div v-else-if="error" class="scene-load-error" role="alert">
      <div class="scene-load-error-card">
        <h2>3D 视图加载失败</h2>
        <p>可以先重试，当前回放会保留。若仍失败，请刷新页面后重新打开 3D。</p>
        <details>
          <summary>查看错误详情</summary>
          <p class="scene-load-error-detail">{{ error.message }}</p>
        </details>
        <div class="scene-load-actions">
          <button class="btn" type="button" @click="load">重试加载</button>
          <button class="btn" type="button" @click="reloadPage">刷新页面</button>
        </div>
        <p class="scene-load-reload-note">刷新页面会重置回放，已导入的日志需要重新导入。</p>
      </div>
    </div>
    <div v-else class="visual-loading" role="status" aria-label="正在加载 3D 视图">
      <div class="visual-loading-core" aria-hidden="true">
        <span class="visual-loading-ring ring-a"></span>
        <span class="visual-loading-ring ring-b"></span>
        <span class="visual-loading-dot"></span>
      </div>
      <p class="visual-loading-title">3D</p>
    </div>
  </div>
</template>

<style scoped>
.scene-loader {
  position: relative;
  width: 100%;
  height: 100%;
}
.scene-load-error {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background: var(--sunken);
}
.scene-load-error-card {
  width: min(100%, 27rem);
  padding: 1.4rem;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--panel);
  color: var(--text);
}
.scene-load-error-card h2 {
  margin: 0 0 0.7rem;
  font-size: 1rem;
}
.scene-load-error-card p,
.scene-load-error-card summary {
  font-size: 0.85rem;
  line-height: 1.6;
}
.scene-load-error-card summary { cursor: pointer; }
.scene-load-error-detail {
  overflow-wrap: anywhere;
  color: var(--muted);
}
.scene-load-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 1rem;
}
.scene-load-error-card .scene-load-reload-note {
  margin-bottom: 0;
  font-size: 0.75rem;
  color: var(--muted);
}
</style>
