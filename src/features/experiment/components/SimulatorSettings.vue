<script setup lang="ts">
import { computed, ref } from 'vue'
import SimulatorDirectoryPicker from './SimulatorDirectoryPicker.vue'

const props = defineProps<{
  modelValue: string
  defaultHome: string
  checking: boolean
  buildStatus: 'idle' | 'building' | 'ok' | 'fail'
  buildLog: string
  buildError: string
  buildProgress: { phase: 'configure' | 'build' | 'catalog' | 'done' | 'failed'; completed: number; total: number } | null
  cleanStatus: 'idle' | 'cleaning' | 'ok' | 'fail'
  cleanError: string
  disabled: boolean
  storageError: string
  result: { ok: boolean; home?: string; source?: string; error?: string } | null
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  precompile: []
  clearBuild: []
  reset: []
  select: [path: string]
}>()
const pickerOpen = ref(false)
const progressPercent = computed(() => props.buildProgress?.phase === 'build' && props.buildProgress.total > 0
  ? Math.round(props.buildProgress.completed / props.buildProgress.total * 100)
  : null)
const progressLabel = computed(() => {
  const progress = props.buildProgress
  if (progress?.phase === 'configure') return '正在配置构建环境…'
  if (progress?.phase === 'catalog') return '正在读取注册协议…'
  if (progress?.phase === 'build' && progress.total > 0) return `已编译 ${progress.completed} / ${progress.total}`
  return '正在构建…'
})
const selectDirectory = (path: string) => {
  emit('select', path)
  pickerOpen.value = false
}

</script>

<template>
  <section class="simulator-settings" aria-label="仿真环境">
    <div class="dock-title">仿真环境</div>
    <div class="field field-compact">
      <label class="field-head" for="simulator-directory"><span>仿真目录</span><span class="field-param">AQUA_SIM_HOME</span></label>
      <div class="directory-input-row">
      <input
        id="simulator-directory"
        class="select directory-input"
        :value="modelValue"
        :disabled="disabled"
        :placeholder="defaultHome ? `留空使用${defaultHome}` : '留空使用服务器默认目录'"
        :title="defaultHome ? `留空使用${defaultHome}` : '留空使用服务器默认目录'"
        spellcheck="false"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="!disabled && !checking && $emit('precompile')"
      />
      <button class="btn btn-compact directory-choose" :disabled="disabled" @click="pickerOpen = true">选择目录</button>
      </div>
    </div>
    <div class="build-actions">
      <button class="btn btn-compact" :disabled="checking || disabled" @click="$emit('precompile')">
        {{ buildStatus === 'building' ? '编译中…' : '预编译' }}
      </button>
      <button class="btn btn-compact" :disabled="checking || disabled" title="清除所选仿真目录的构建产物与配置缓存" @click="$emit('clearBuild')">
        {{ cleanStatus === 'cleaning' ? '清除中…' : '清除构建' }}
      </button>
      <button class="btn btn-compact" :disabled="!modelValue || disabled" @click="$emit('reset')">恢复默认</button>
    </div>
    <div class="directory-result" role="status" aria-live="polite">
      <div v-if="buildStatus === 'building'" class="build-progress">
        <span>{{ progressLabel }}</span>
        <progress v-if="progressPercent !== null" aria-label="预编译进度" :value="progressPercent" max="100"></progress>
        <progress v-else aria-label="预编译进度"></progress>
        <span v-if="progressPercent !== null">{{ progressPercent }}%</span>
      </div>
      <p v-else-if="cleanStatus === 'cleaning'">正在清除构建…</p>
      <p v-else-if="cleanStatus === 'ok'" class="directory-ok">构建已清除，重新预编译后可运行仿真</p>
      <p v-else-if="cleanStatus === 'fail'" class="directory-error">{{ cleanError }}</p>
      <p v-else-if="buildStatus === 'ok'" class="directory-ok">预编译完成</p>
      <p v-else-if="buildStatus === 'fail'" class="directory-error">{{ buildError }}</p>
      <template v-else-if="result">
        <p :class="result.ok ? 'directory-ok' : 'directory-error'">
          {{ result.ok ? '目录检查通过（尚未验证编译）' : result.error || '目录检查失败' }}
        </p>
      </template>
      <p v-if="storageError" class="directory-error">{{ storageError }}</p>
    </div>
    <details v-if="buildLog" class="build-output" :open="buildStatus === 'fail' || cleanStatus === 'fail'">
      <summary>构建输出</summary>
      <pre>{{ buildLog }}</pre>
    </details>
    <SimulatorDirectoryPicker
      v-if="pickerOpen && !disabled"
      :initial-path="modelValue"
      @select="selectDirectory"
      @close="pickerOpen = false"
    />
  </section>
</template>

<style scoped>
.simulator-settings { display: grid; gap: 8px; min-width: 0; }
.directory-input-row { display: flex; align-items: center; gap: 6px; }
.directory-input { flex: 1; width: 0; min-width: 0; font-family: var(--font-mono); }
.directory-choose { flex-shrink: 0; white-space: nowrap; }
.build-actions { display: grid; grid-template-columns: 72px minmax(0, 1fr) minmax(0, 1fr); gap: 6px; }
.build-actions .btn { min-width: 0; padding-inline: 0.45rem; }
.directory-result { font-size: 11px; line-height: 1.6; color: var(--muted); overflow-wrap: anywhere; }
.build-progress { display: grid; gap: 4px; }
.build-progress progress { width: 100%; height: 8px; accent-color: var(--accent); }
.directory-ok { color: var(--rx); }
.directory-error { color: var(--bad); }
.build-output { min-width: 0; font-size: 11px; color: var(--muted); }
.build-output summary { cursor: pointer; }
.build-output pre { max-height: 220px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; padding: 8px; margin: 6px 0 0; border-radius: var(--r-sm); background: var(--sunken); font-family: var(--font-mono); }
</style>
