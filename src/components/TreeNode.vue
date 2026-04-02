<script setup>
import { computed } from 'vue'

const props = defineProps({
  node: Object,
  selectedId: String
})

const emit = defineEmits(['select', 'delete', 'add-child'])

const typeIcon = computed(() => ({ section: '▸', question: '◉', subquestion: '○', icf: '⊞', branch: '⋱' }[props.node.type] ?? '·'))
const typeLabel = computed(() => ({ section: 'Abschnitt', question: 'Screeningfrage', subquestion: 'Unterfrage', icf: 'ICF-Item', branch: 'Verzweigung' }[props.node.type] ?? ''))
</script>

<template>
  <div class="tree-node">
    <div class="tree-item" :class="{ selected: node.id === selectedId }" @click.stop="emit('select', node.id)">
      <span class="ti-icon">{{ typeIcon }}</span>
      <span class="ti-label">{{ node.label }}</span>
      <span class="ti-badge" :class="'badge-' + node.type">{{ typeLabel }}</span>
      <div class="ti-actions" @click.stop>
        <button class="btn btn-ghost btn-sm btn-icon" title="Löschen" @click="emit('delete', node.id)" style="color:var(--red-text);font-size:11px">✕</button>
      </div>
    </div>

    <div v-if="node.children?.length" class="tree-children">
      <TreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :selected-id="selectedId"
        @select="emit('select', $event)"
        @delete="emit('delete', $event)"
        @add-child="emit('add-child', $event)"
      />
    </div>

    <template v-if="node.branches">
      <div v-for="(branch, bi) in node.branches" :key="bi">
        <div v-if="branch.children?.length" class="tree-children">
          <div class="branch-path-label">→ {{ branch.label }}</div>
          <TreeNode
            v-for="child in branch.children"
            :key="child.id"
            :node="child"
            :selected-id="selectedId"
            @select="emit('select', $event)"
            @delete="emit('delete', $event)"
            @add-child="emit('add-child', $event)"
          />
        </div>
      </div>
    </template>
  </div>
</template>
