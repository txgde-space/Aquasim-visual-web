<script setup lang="ts">
import { computed } from 'vue'
import type { SceneAssetType } from '@/shared/sceneAssets'
import { ASSET_FINISHES, sceneAssetParts, sceneAssetBounds } from '@/shared/sceneAssetGeometry'
const props = defineProps<{ type: SceneAssetType }>()
const parts = computed(() => [...sceneAssetParts(props.type)].sort((a, b) => a.at[2] - b.at[2]))
const bounds = computed(() => {
  const { min, max } = sceneAssetBounds(props.type)
  const [left, bottom] = min, [right, top] = max
  const width = right - left, height = Math.max(top - bottom, width * 0.4), pad = width * 0.08
  return { box: `${left - pad} ${-(top + bottom) / 2 - height / 2 - pad} ${width + pad * 2} ${height + pad * 2}`, stroke: width / 180 }
})
</script>

<template>
  <svg class="asset-thumbnail" :viewBox="bounds.box" aria-hidden="true">
    <g transform="scale(1 -1)" :stroke="ASSET_FINISHES.dark.color" :stroke-width="bounds.stroke" stroke-linejoin="round">
      <g v-for="(part, index) in parts" :key="index" :transform="`translate(${part.at[0]} ${part.at[1]}) rotate(${(part.yaw ?? 0) * 180 / Math.PI})`" :fill="ASSET_FINISHES[part.finish].color">
        <polygon v-if="part.outline" :points="part.outline!.map(point => point.join(',')).join(' ')" />
        <rect v-else-if="part.shape === 'box'" :x="-part.size[0] / 2" :y="-part.size[1] / 2" :width="part.size[0]" :height="part.size[1]" />
        <ellipse v-else :rx="(part.axis === 'x' ? part.size[2] : part.size[0]) / 2" :ry="part.size[1] / 2" />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.asset-thumbnail { display: block; width: 100%; height: 42px; margin: 3px 0; }
</style>
