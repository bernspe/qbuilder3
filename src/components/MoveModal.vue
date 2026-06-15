<script setup>
const props = defineProps({
  node: Object,
  targets: Array,
})
const emit = defineEmits(['close', 'move'])

const targetIcon = { section: '▸', question: '◉' }
const title = props.node?.type === 'question'
  ? 'Frage in anderen Abschnitt verschieben'
  : 'Element zu anderer Screeningfrage verschieben'
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <h3>{{ title }}</h3>
      <p style="font-size:13px;color:var(--text3);margin-bottom:12px">
        <strong>„{{ node.label }}"</strong> verschieben nach:
      </p>
      <div v-if="targets.length === 0" style="color:var(--text3);font-size:13px;padding:8px 0">
        Keine anderen Ziele verfügbar.
      </div>
      <div
        v-for="t in targets"
        :key="t.id"
        class="tree-item"
        style="cursor:pointer;margin-bottom:3px"
        @click="emit('move', { nodeId: node.id, targetParentId: t.id })"
      >
        <span class="ti-icon">{{ targetIcon[t.type] }}</span>
        <span class="ti-label">{{ t.label }}</span>
      </div>
      <div class="modal-actions" style="margin-top:16px">
        <button class="btn" @click="emit('close')">Abbrechen</button>
      </div>
    </div>
  </div>
</template>
