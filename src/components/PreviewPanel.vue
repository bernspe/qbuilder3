<script setup>
import { computed } from 'vue'

const props = defineProps({ nodes: Array })

const flatQuestions = computed(() => {
  const result = []
  const collect = (list) => {
    for (const n of list) {
      if (n.type === 'question') result.push(n)
      if (n.children) collect(n.children)
      if (n.branches) n.branches.forEach(b => b.children && collect(b.children))
    }
  }
  collect(props.nodes)
  return result
})

function resolveOptions(node) {
  if (node.questionType === 'yesno') return ['Ja', 'Nein']
  return node.options?.length ? node.options : ['(noch keine Optionen)']
}
</script>

<template>
  <div>
    <template v-for="node in flatQuestions" :key="node.id">
      <div class="preview-q">
        <div class="q-label">
          {{ node.label }}
          <span v-if="node.required" class="q-required"> *</span>
        </div>
        <div v-if="node.helpText" class="q-help">{{ node.helpText }}</div>

        <template v-if="node.questionType === 'single' || node.questionType === 'yesno'">
          <div class="preview-opt" v-for="opt in resolveOptions(node)" :key="opt">
            <input type="radio" disabled /> {{ opt }}
          </div>
        </template>
        <template v-else-if="node.questionType === 'multiple'">
          <div class="preview-opt" v-for="opt in node.options" :key="opt">
            <input type="checkbox" disabled /> {{ opt }}
          </div>
        </template>
        <template v-else-if="node.questionType === 'text'">
          <input type="text" disabled placeholder="Freitext-Eingabe..." style="width:100%;opacity:0.5" />
        </template>
        <template v-else-if="node.questionType === 'scale'">
          <div style="display:flex;gap:6px;margin-top:4px">
            <button class="btn btn-sm" v-for="n in 5" :key="n" disabled>{{ n }}</button>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3);margin-top:4px">
            <span>{{ node.scaleMin ?? '1 – gar nicht' }}</span>
            <span>{{ node.scaleMax ?? '5 – voll zu' }}</span>
          </div>
        </template>
        <template v-else-if="node.questionType === 'number'">
          <input type="number" disabled placeholder="0" style="width:120px;opacity:0.5" />
        </template>
        <template v-else-if="node.questionType === 'date'">
          <input type="date" disabled style="opacity:0.5" />
        </template>
      </div>
    </template>
    <div v-if="!flatQuestions.length" style="text-align:center;padding:30px;color:var(--text3);font-size:13px">
      Noch keine Fragen vorhanden.
    </div>
  </div>
</template>
