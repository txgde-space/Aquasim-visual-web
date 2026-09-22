<script setup lang="ts">
import { ref } from 'vue'
import SimulatorDirectoryPicker from './SimulatorDirectoryPicker.vue'

defineProps<{
  modelValue: string
  defaultHome: string
  checking: boolean
  buildStatus: 'idle' | 'building' | 'ok' | 'fail'
  buildLog: string
  buildError: string
  disabled: boolean
  storageError: string
  result: { ok: boolean; home?: string; source?: string; error?: string } | null
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  precompile: []
  reset: []
  select: [path: string]
}>()
const pickerOpen = ref(false)
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
    <div class="control-btn-row">
      <button class="btn btn-compact" :disabled="checking || disabled" @click="$emit('precompile')">
        {{ buildStatus === 'building' ? '预编译中…' : '预编译' }}
      </button>
      <button class="btn btn-compact" :disabled="!modelValue || disabled" @click="$emit('reset')">恢复默认</button>
    </div>
    <div class="directory-result" role="status" aria-live="polite">
      <p v-if="buildStatus === 'building'">正在预编译，首次编译可能需要数分钟…</p>
      <p v-else-if="buildStatus === 'ok'" class="directory-ok">预编译完成</p>
      <p v-else-if="buildStatus === 'fail'" class="directory-error">{{ buildError }}</p>
      <template v-else-if="result">
        <p :class="result.ok ? 'directory-ok' : 'directory-error'">
          {{ result.ok ? '目录检查通过（尚未验证编译）' : result.error || '目录检查失败' }}
        </p>
      </template>
      <p v-if="storageError" class="directory-error">{{ storageError }}</p>
    </div>
    <details v-if="buildLog" class="build-output" :open="buildStatus === 'fail'">
      <summary>编译输出</summary>
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
.directory-result { font-size: 11px; line-height: 1.6; color: var(--muted); overflow-wrap: anywhere; }
.directory-ok { color: var(--rx); }
.directory-error { color: var(--bad); }
.build-output { min-width: 0; font-size: 11px; color: var(--muted); }
.build-output summary { cursor: pointer; }
.build-output pre { max-height: 220px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; padding: 8px; margin: 6px 0 0; border-radius: var(--r-sm); background: var(--sunken); font-family: var(--font-mono); }
</style>
