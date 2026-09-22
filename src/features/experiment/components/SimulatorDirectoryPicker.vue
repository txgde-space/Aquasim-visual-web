<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useDirectoryBrowser } from '../composables/useDirectoryBrowser'

const props = defineProps<{ initialPath: string }>()
const emit = defineEmits<{ select: [path: string]; close: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const { listing, loading, error, browse } = useDirectoryBrowser()
const canSelect = computed(() => !!listing.value?.simulator.ok && !loading.value && !error.value)

const selectCurrent = () => {
  if (canSelect.value && listing.value) emit('select', listing.value.home)
}

onMounted(() => {
  dialog.value?.showModal()
  void browse(props.initialPath)
})
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="directory-picker" aria-labelledby="directory-picker-title" @cancel.prevent="emit('close')">
      <div class="picker-head">
        <h2 id="directory-picker-title">选择仿真目录</h2>
        <button class="btn btn-compact" autofocus @click="emit('close')">取消</button>
      </div>
      <p class="picker-hint">浏览运行服务的机器，进入 aqua-sim-dev 文件夹后选用。</p>
      <nav class="picker-actions" aria-label="目录导航">
        <button class="btn btn-compact" :disabled="loading || !listing?.parent" @click="browse(listing!.parent!)">上一级</button>
        <button class="btn btn-compact" :disabled="loading" @click="browse('~')">用户目录</button>
        <button class="btn btn-compact" :disabled="loading" @click="browse('.')">项目目录</button>
        <button class="btn btn-compact" :disabled="loading" @click="browse('')">默认目录</button>
      </nav>
      <p class="picker-path" aria-label="当前目录">{{ listing?.home || initialPath || '服务器默认目录' }}</p>
      <div class="picker-folders" :aria-busy="loading">
        <p v-if="loading" class="picker-hint" role="status">正在读取目录…</p>
        <p v-else-if="error" class="picker-error" role="alert">{{ error }}</p>
        <template v-else-if="listing">
          <p v-if="!listing.directories.length" class="picker-hint">此目录没有子文件夹。</p>
          <ul v-else aria-label="子文件夹">
            <li v-for="folder in listing.directories" :key="folder.path">
              <button class="folder-button" :aria-label="`打开文件夹 ${folder.name}`" @click="browse(folder.path)">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                  <path d="M3 7V5h7l2 2h9v13H3V7Z" />
                </svg>
                <span>{{ folder.name }}</span>
                <span aria-hidden="true">›</span>
              </button>
            </li>
          </ul>
        </template>
      </div>
      <p class="picker-hint" role="status">
        <template v-if="!loading && !error && listing">
          {{ listing.simulator.ok ? '已找到 ns3 与 Aqua-Sim 模块，可选用此目录。' : '请进入包含 ns3 与 src/aqua-sim-tg 的仿真目录。' }}
        </template>
      </p>
      <div class="picker-footer">
        <button class="btn btn-compact" :disabled="!canSelect" @click="selectCurrent">选用此目录</button>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.directory-picker { width: min(560px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); margin: auto; padding: 20px; overflow: auto; border: 1px solid var(--line-strong); border-radius: var(--r-lg); background: var(--panel-solid); color: var(--text); box-shadow: var(--shadow-pop); z-index: 80; }
.directory-picker::backdrop { background: color-mix(in srgb, var(--sunken) 65%, transparent); backdrop-filter: blur(4px); }
.picker-head, .picker-actions, .picker-footer { display: flex; align-items: center; gap: 8px; }
.picker-head { justify-content: space-between; }
.picker-head h2 { font-size: 16px; }
.picker-actions { flex-wrap: wrap; margin: 12px 0; }
.picker-hint { margin-top: 10px; color: var(--muted); font-size: 12px; line-height: 1.6; }
.picker-path { padding: 10px; background: var(--sunken); border-radius: var(--r-sm); overflow-wrap: anywhere; font: 12px/1.6 var(--font-mono); }
.picker-folders { height: min(300px, 38dvh); margin-top: 10px; overflow: auto; border: 1px solid var(--line); border-radius: var(--r-sm); padding: 6px; }
.picker-folders ul { list-style: none; padding: 0; margin: 0; }
.folder-button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px; border: 0; border-radius: var(--r-sm); background: transparent; color: var(--text); text-align: left; cursor: pointer; }
.folder-button:hover { background: var(--raised); }
.folder-button svg { flex-shrink: 0; color: var(--accent); }
.folder-button span:first-of-type { flex: 1; overflow-wrap: anywhere; min-width: 0; }
.picker-error { color: var(--bad); overflow-wrap: anywhere; font-size: 12px; }
.picker-footer { justify-content: flex-end; margin-top: 14px; }
</style>
