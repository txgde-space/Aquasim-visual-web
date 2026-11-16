<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useFieldDevices } from './useFieldDevices'
import { deviceLabel, utcLabel, type FieldDevice } from './lib/devices'

const devices = useFieldDevices()
const { status, preferences, serviceError, actionError, message, busy, ports, portsLoading, portsError, storageError, statusStale } = devices
const dialog = ref<HTMLDialogElement | null>(null)
const settingsOpen = ref(false)
const settingsButton = ref<HTMLButtonElement | null>(null)
const deviceChoices: { id: FieldDevice; name: string }[] = [{ id: 'gps', name: 'GPS' }, { id: 'atomic', name: '原子钟' }]
const coordinate = computed(() => {
  const gps = status.value?.gps
  if (!Number.isFinite(gps?.latitude) || !Number.isFinite(gps?.longitude)) return '经纬度 —'
  return `${!gps?.fixValid || gps.stale ? '上次位置 ' : ''}${gps!.longitude!.toFixed(6)}°, ${gps!.latitude!.toFixed(6)}°`
})
const gpsState = computed(() => {
  const gps = status.value?.gps
  if (!gps?.connected || gps.stale || serviceError.value || gps.error) return deviceLabel(gps, serviceError.value)
  return gps.fixValid ? '已定位' : '未定位'
})
const atomicState = computed(() => deviceLabel(status.value?.atomic, serviceError.value))
const gpsTime = computed(() => status.value?.gps.validTime === false ? '—' : utcLabel(status.value?.gps.utcTime))
const atomicTime = computed(() => status.value?.atomic.validTime === false ? '—' : utcLabel(status.value?.atomic.utcTime))
const canSyncGps = computed(() => !busy.value && !statusStale.value && status.value?.atomic.connected && status.value?.gps.connected
  && status.value.gps.validTime && !status.value.gps.stale)
const canSyncSystem = computed(() => !busy.value && !statusStale.value && status.value?.atomic.connected)
const openSettings = async () => {
  settingsOpen.value = true
  await nextTick()
  dialog.value?.showModal()
  void devices.loadPorts()
}
const closeSettings = () => {
  devices.savePreferences()
  dialog.value?.close()
  settingsOpen.value = false
  settingsButton.value?.focus()
}
</script>

<template>
  <section class="field-devices" aria-label="真实试验设备状态" @pointerdown.stop @wheel.stop>
    <header class="field-head">
      <strong>现场设备</strong><span class="utc-tag">UTC</span>
      <button ref="settingsButton" class="btn btn-compact field-settings" @click="openSettings">设备设置</button>
    </header>
    <dl class="readings" :class="{ stale: statusStale }">
      <div class="reading"><dt>GPS <span :class="{ warning: !status?.gps.fixValid || status?.gps.stale }">{{ gpsState }}</span></dt><dd>{{ gpsTime }}</dd></div>
      <div class="coordinate">{{ coordinate }}<span v-if="status?.gps.satellites !== undefined"> · {{ status.gps.satellites }} 星</span></div>
      <div class="reading"><dt>原子钟 <span :class="{ warning: status?.atomic.stale || !status?.atomic.connected }">{{ atomicState }}</span></dt><dd>{{ atomicTime }}</dd></div>
      <div class="reading"><dt>系统时间 <span>{{ statusStale ? '未更新' : '服务端' }}</span></dt><dd>{{ utcLabel(status?.systemTime) }}</dd></div>
    </dl>
    <p v-if="serviceError" class="service-error" :title="serviceError" role="status">{{ serviceError }}</p>

    <Teleport to="body">
      <dialog v-if="settingsOpen" ref="dialog" class="field-dialog" aria-labelledby="field-settings-title" @cancel.prevent="closeSettings" @keydown.esc.stop>
        <header class="dialog-head"><h2 id="field-settings-title">真实试验 · 设备设置</h2><button class="btn btn-compact" autofocus @click="closeSettings">关闭</button></header>
        <p class="hint">连接运行服务的机器上的串口。设备读数与系统时间统一以 UTC 显示；切换板块不会关闭已连接的设备。</p>
        <div class="ports-action"><button class="btn btn-compact" :disabled="portsLoading || busy" @click="devices.loadPorts">{{ portsLoading ? '正在查找…' : '刷新串口' }}</button><span class="hint">{{ ports.length ? `发现 ${ports.length} 个串口` : '可手动输入串口路径' }}</span></div>
        <p v-if="portsError" class="error" role="alert">{{ portsError }}</p>
        <datalist id="field-device-ports"><option v-for="port in ports" :key="port" :value="port" /></datalist>
        <div class="device-settings">
          <section v-for="device in deviceChoices" :key="device.id" class="serial-card">
            <header><h3>{{ device.name }}</h3><span>{{ deviceLabel(status?.[device.id], serviceError) }}</span></header>
            <p v-if="status?.[device.id].connected" class="connected-port">{{ status?.[device.id].port }} · {{ status?.[device.id].baudRate }} baud</p>
            <fieldset :disabled="busy || status?.[device.id].connected">
              <label class="port-field"><span>串口 <small class="field-param">port</small></span><input v-model="preferences[device.id].port" class="select" list="field-device-ports" :aria-label="`${device.name} 串口`" placeholder="/dev/ttyUSB0 或 COM3" autocomplete="off" /></label>
              <label><span>波特率 <small class="field-param">baud</small></span><input v-model.number="preferences[device.id].baudRate" class="select" type="number" min="300" max="4000000" :aria-label="`${device.name} 波特率`" /></label>
              <label><span>数据位 <small class="field-param">data bits</small></span><select v-model.number="preferences[device.id].dataBits" class="select" :aria-label="`${device.name} 数据位`"><option v-for="bits in [5, 6, 7, 8]" :key="bits" :value="bits">{{ bits }}</option></select></label>
              <label><span>停止位 <small class="field-param">stop bits</small></span><select v-model.number="preferences[device.id].stopBits" class="select" :aria-label="`${device.name} 停止位`"><option :value="1">1</option><option :value="2">2</option></select></label>
              <label><span>校验位 <small class="field-param">parity</small></span><select v-model="preferences[device.id].parity" class="select" :aria-label="`${device.name} 校验位`"><option value="none">无</option><option value="even">偶校验</option><option value="odd">奇校验</option></select></label>
              <label v-if="device.id === 'atomic'" class="port-field"><span>查询间隔 <small class="field-param">ms</small></span><input v-model.number="preferences.atomic.pollIntervalMs" class="select" type="number" min="200" max="60000" step="100" aria-label="原子钟查询间隔" /></label>
            </fieldset>
            <div class="serial-actions"><button v-if="!status?.[device.id].connected" class="btn" :disabled="busy || !preferences[device.id].port.trim()" @click="devices.connect(device.id)">连接{{ device.name }}</button><button v-else class="btn" :disabled="busy" @click="devices.disconnect(device.id)">断开{{ device.name }}</button></div>
            <p v-if="status?.[device.id].error" class="error">{{ status?.[device.id].error }}</p>
            <p class="hint">最近接收：<span class="mono">{{ utcLabel(status?.[device.id].lastReceivedAt) }}</span></p>
          </section>
        </div>
        <section class="sync-section">
          <h3>原子钟校时</h3>
          <p class="hint">选择时间源后向原子钟发送设置指令。发送完成后请核对返回读数；系统时钟保持原值。</p>
          <div class="sync-actions"><button class="btn btn-compact" :disabled="!canSyncGps" @click="devices.synchronize('gps')">使用 GPS 时间校时</button><button class="btn btn-compact" :disabled="!canSyncSystem" @click="devices.synchronize('system')">使用服务端系统时间校时</button></div>
          <p v-if="status?.atomic.lastSync" class="hint">最近指令：{{ status.atomic.lastSync.source === 'gps' ? 'GPS' : '系统时间' }} → {{ utcLabel(status.atomic.lastSync.targetUtcTime) }} UTC（已发送）</p>
          <details v-if="status?.atomic.raw"><summary>原子钟原始回复</summary><pre>{{ status.atomic.raw }}</pre></details>
        </section>
        <p v-if="serviceError" class="error" role="status">{{ serviceError }}</p>
        <p v-if="actionError" class="error" role="alert">{{ actionError }}</p>
        <p v-if="message" class="message" role="status">{{ message }}</p>
        <p v-if="storageError" class="hint">{{ storageError }}</p>
      </dialog>
    </Teleport>
  </section>
</template>

<style scoped>
.field-devices { position: absolute; right: 14px; bottom: 14px; width: min(324px, calc(100% - 28px)); z-index: 10; padding: 10px 12px; border: 1px solid var(--line-strong); border-radius: var(--r-lg); background: var(--panel); backdrop-filter: blur(18px); color: var(--text); box-shadow: var(--shadow-island); font: 12px/1.5 var(--font-ui); }
.field-head, .dialog-head, .serial-card header { display: flex; align-items: center; gap: 8px; }
.field-head strong { font-size: 12px; font-weight: 600; }.utc-tag { color: var(--muted); font: 10px var(--font-mono); }.field-settings { margin-left: auto; height: 25px; min-height: 25px; font-size: 11px; padding: 2px 8px; }
.readings { margin-top: 5px; }.reading { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }.reading dt { flex-shrink: 0; }.reading dt span { margin-left: 5px; color: var(--muted); font-size: 10px; }.reading dt span.warning { color: var(--warn); }.reading dd { margin: 0; font: 10px/1.8 var(--font-mono); font-variant-numeric: tabular-nums; white-space: nowrap; }.coordinate { text-align: right; color: var(--muted); font: 10px/1.6 var(--font-mono); }.stale dd, .stale .coordinate { color: var(--muted); }.service-error { color: var(--warn); margin-top: 5px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 11px; }
.field-dialog { width: min(740px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); margin: auto; padding: 20px; overflow: auto; border: 1px solid var(--line-strong); border-radius: var(--r-lg); background: var(--panel-solid); color: var(--text); box-shadow: var(--shadow-pop); z-index: 80; font: 13px/1.5 var(--font-ui); }.field-dialog::backdrop { background: color-mix(in srgb, var(--sunken) 65%, transparent); backdrop-filter: blur(4px); }.dialog-head { justify-content: space-between; }.dialog-head h2 { font-size: 16px; }.hint { margin-top: 7px; font-size: 12px; color: var(--muted); line-height: 1.6; }.ports-action { display: flex; align-items: center; gap: 10px; margin: 14px 0 10px; }.ports-action .hint { margin: 0; }.device-settings { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }.serial-card { padding: 12px; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--raised); }.serial-card header { justify-content: space-between; }.serial-card h3, .sync-section h3 { font-size: 13px; }.serial-card header span { color: var(--muted); font-size: 11px; }.connected-port { font: 11px/1.5 var(--font-mono); color: var(--accent); margin-top: 6px; overflow-wrap: anywhere; }fieldset { border: 0; padding: 0; margin: 10px 0 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }fieldset label { display: grid; gap: 3px; min-width: 0; }fieldset label > span { font-size: 11px; }fieldset .field-param { font-size: 10px; color: var(--muted); font-family: var(--font-mono); }.port-field { grid-column: 1 / -1; }.select { width: 100%; min-width: 0; }.serial-actions { margin-top: 10px; }.sync-section { margin-top: 16px; border-top: 1px solid var(--line); padding-top: 14px; }.sync-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }.error, .message { margin-top: 10px; font-size: 12px; overflow-wrap: anywhere; }.error { color: var(--bad); }.message { color: var(--rx); }.mono { font-family: var(--font-mono); }details { margin-top: 10px; }summary { cursor: pointer; font-size: 12px; color: var(--muted); }pre { max-height: 100px; overflow: auto; margin-top: 6px; font-size: 11px; white-space: pre-wrap; overflow-wrap: anywhere; }
.field-dialog { color-scheme: dark; }
[data-theme="light"] .field-dialog { color-scheme: light; }
select.select {
  appearance: none;
  padding-inline-end: 28px;
  background-image:
    linear-gradient(45deg, transparent 50%, var(--muted) 50%),
    linear-gradient(135deg, var(--muted) 50%, transparent 50%);
  background-position: calc(100% - 13px) 50%, calc(100% - 9px) 50%;
  background-size: 4px 4px;
  background-repeat: no-repeat;
  font-family: var(--font-ui);
  cursor: pointer;
}
.select:disabled { opacity: .45; cursor: not-allowed; }
.select:disabled:hover { border-color: var(--line); }
@media (max-width: 600px) { .device-settings { grid-template-columns: 1fr; }.field-dialog { padding: 14px; } }
</style>
