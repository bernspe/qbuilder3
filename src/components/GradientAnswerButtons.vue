<template>
  <div class="answer-btn-row">
    <button
      v-for="(opt, i) in options"
      :key="i"
      class="answer-btn"
      :class="{ selected: defaultIdx === i }"
      :style="`background-color:${buttonColor(i)}`"
      :disabled="disabled"
    >{{ opt }}</button>
  </div>
</template>

<script setup>
const props = defineProps({
  options: { type: Array, default: () => [] },
  defaultIdx: { type: Number, default: null },
  colorScheme: { type: String, default: 'restriction' },
  order: { type: String, default: 'schlecht-gut' },
  disabled: { type: Boolean, default: true }
})

function hslColor(hue, sat = 65, light = 42) {
  return `hsl(${hue}, ${sat}%, ${light}%)`
}

function buttonColor(i) {
  const n = props.options.length
  if (n === 0) return hslColor(0)

  if (props.colorScheme === 'yesno') {
    // Ja (index 0) = grün, Nein (index 1) = rot
    return i === 0 ? hslColor(120) : hslColor(0)
  }

  // For restriction and environment, determine effective index considering order
  const idx = props.order === 'gut-schlecht' ? (n - 1 - i) : i

  if (props.colorScheme === 'environment') {
    // 0-4: rot→gelb (hue 0→55), 5-8: gelb→grün (hue 55→120)
    if (idx <= 4) {
      const hue = Math.round(idx * 55 / 4)
      return hslColor(hue)
    } else {
      const hue = Math.round(55 + (idx - 5) * 65 / 3)
      return hslColor(hue)
    }
  }

  // restriction: interpolate hue 0 (rot) → 120 (grün)
  const hue = n === 1 ? 60 : Math.round(idx * 120 / (n - 1))
  return hslColor(hue)
}
</script>
