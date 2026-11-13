<script setup lang="ts">
defineProps<{options:{id:number;label:string}[];movingId:number|null;input:string;distance:number;error:string;disabled:boolean}>()
const emit=defineEmits<{'update:movingId':[id:number];'update:input':[value:string];apply:[];close:[]}>()
</script>
<template>
  <form class="distance-editor" aria-label="设置节点距离" @submit.prevent="emit('apply')" @pointerdown.stop @wheel.stop @keydown.esc.stop.prevent="emit('close')">
    <header><strong>设置距离</strong><button type="button" aria-label="关闭距离设置" @click="emit('close')">×</button></header>
    <template v-if="options.length">
      <label>移动节点<select :value="movingId" :disabled="disabled" @change="emit('update:movingId',Number(($event.target as HTMLSelectElement).value))"><option v-for="option in options" :key="option.id" :value="option.id">{{option.label}}</option></select></label>
      <label>距离 <span class="unit">m / km</span><input :value="input" :disabled="disabled" aria-label="目标距离" placeholder="500m / 1.5km" @input="emit('update:input',($event.target as HTMLInputElement).value)" /></label>
      <footer><output>{{Number(distance.toFixed(2))}} m</output><button class="btn primary" :disabled="disabled" type="submit">应用</button></footer>
    </template>
    <p v-else>没有可移动的节点</p>
    <p v-if="error" class="error" role="alert">{{error}}</p>
  </form>
</template>
<style scoped>
.distance-editor {position:absolute;z-index:30;width:246px;box-sizing:border-box;padding:12px;border:1px solid var(--line-strong);border-radius:var(--r-md);background:var(--panel);backdrop-filter:blur(16px);box-shadow:var(--shadow-pop);color:var(--text);display:grid;gap:10px;font-size:12px;}
header,footer{display:flex;align-items:center;justify-content:space-between;gap:8px;}header button{border:0;background:transparent;color:var(--muted);font-size:20px;cursor:pointer;padding:0 3px;}label{display:flex;align-items:center;flex-wrap:wrap;gap:5px;color:var(--muted);}input,select{width:100%;min-width:0;box-sizing:border-box;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--sunken);color:var(--text);padding:7px;font:12px var(--font-mono);}input:focus,select:focus{outline:1px solid var(--accent);}output,.unit{font:10px var(--font-mono);color:var(--muted);}footer .btn{padding:6px 12px;font-size:11px;}p{margin:0;color:var(--muted);}.error{color:var(--bad);line-height:1.5;}
</style>
