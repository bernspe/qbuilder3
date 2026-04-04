<template>
  <span class="icon-display" :style="`width:${size}px;height:${size}px`">
    <img
      v-if="isIcf || isIconify"
      :src="resolvedUrl"
      :style="`width:${size}px;height:${size}px;object-fit:contain`"
      alt=""
    />
    <span v-else-if="isSvg" v-html="svgContent" />
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { getIcfIconPath } from '../composables/useIcfData.js'

const props = defineProps({
  icon: { type: String, default: '' },
  size: { type: Number, default: 32 }
})

const isIcf = computed(() => props.icon.startsWith('icf:'))
const isSvg = computed(() => props.icon.startsWith('svg:'))
// Everything with a colon that isn't icf: or svg: is treated as an Iconify
// prefix:name pair — users can paste directly from icon-sets.iconify.design
const isIconify = computed(() => !isIcf.value && !isSvg.value && props.icon.includes(':'))

function buildIconifyUrl(raw) {
  // Strip legacy "iconify:" prefix if present
  const name = raw.startsWith('iconify:') ? raw.slice(8) : raw
  // Modern format: prefix:icon-name  (e.g. twemoji:man-standing)
  if (name.includes(':')) {
    const colonIdx = name.indexOf(':')
    const prefix = name.slice(0, colonIdx)
    const icon = name.slice(colonIdx + 1)
    return `https://api.iconify.design/${prefix}/${icon}.svg`
  }
  // Legacy format: prefix-icon-name  (e.g. mdi-home, only reachable via old iconify: prefix)
  const dashIdx = name.indexOf('-')
  if (dashIdx === -1) return ''
  const prefix = name.slice(0, dashIdx)
  const icon = name.slice(dashIdx + 1)
  return `https://api.iconify.design/${prefix}/${icon}.svg`
}

const resolvedUrl = computed(() => {
  if (isIcf.value) return getIcfIconPath(props.icon.slice(4))
  if (isIconify.value) return buildIconifyUrl(props.icon)
  return ''
})

const svgContent = computed(() => isSvg.value ? props.icon.slice(4) : '')
</script>
