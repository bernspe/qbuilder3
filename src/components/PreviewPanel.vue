<script setup>
import { computed, watch, nextTick } from 'vue'
import IconDisplay from './IconDisplay.vue'
import GradientAnswerButtons from './GradientAnswerButtons.vue'
import { getIcfAnswers } from '../composables/useIcfData.js'

const props = defineProps({
  nodes: Array,
  selectedId: { type: String, default: null },
  variantId: { type: String, default: 'main' },
  isMainVariant: { type: Boolean, default: true },
  ratings: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['rate'])

function getNodeRating(nodeId, type) {
  return props.ratings[props.variantId]?.[nodeId]?.[type] ?? null
}

function handleRate(nodeId, type, value) {
  if (props.isMainVariant) return
  emit('rate', { nodeId, type, value })
}

const QUESTION_TYPES = ['question', 'subquestion', 'icf']

// Flat list of sections (as headings) + question-type nodes in tree order,
// each wrapped as { node, depth } so the template can show hierarchy
const flatItems = computed(() => {
  const result = []
  const collect = (list, depth = 0) => {
    for (const n of list) {
      if (n.type === 'section') {
        result.push({ node: n, depth: 0 })
        if (n.children) collect(n.children, 1)
      } else if (QUESTION_TYPES.includes(n.type)) {
        result.push({ node: n, depth })
        if (n.children) collect(n.children, depth + 1)
      }
      if (n.branches) n.branches.forEach(b => b.children && collect(b.children, depth))
    }
  }
  collect(props.nodes)
  return result
})

function resolveAnswers(node) {
  if (node.type === 'icf') return getIcfAnswers(node.icfCode)
  if (node.questionType === 'yesno') return ['Ja', 'Nein']
  if (node.questionType === 'scale') return ['1', '2', '3', '4', '5']
  return node.options?.length ? node.options : []
}

function resolveColorScheme(node) {
  if (node.type === 'icf') return node.icfCode?.toLowerCase().startsWith('e') ? 'environment' : 'restriction'
  return 'restriction'
}

function resolveAnswerOrder(node) {
  if (node.type === 'icf') return node.icfCode?.toLowerCase().startsWith('e') ? 'schlecht-gut' : 'gut-schlecht'
  return node.answerOrder ?? 'schlecht-gut'
}

// Refs map: node.id → DOM element
const itemRefs = {}
function setRef(el, id) {
  if (el) itemRefs[id] = el
  else delete itemRefs[id]
}

// Scroll to and highlight selected node
watch(() => props.selectedId, async (id) => {
  if (!id) return
  await nextTick()
  const el = itemRefs[id]
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}, { immediate: true })
</script>

<template>
  <div>
    <template v-for="{ node, depth } in flatItems" :key="node.id">

      <!-- Section heading -->
      <div v-if="node.type === 'section'" class="preview-section-heading">
        {{ node.label }}
      </div>

      <!-- Question card -->
      <div
        v-else
        :ref="el => setRef(el, node.id)"
        class="preview-q"
        :class="[
          { 'preview-q--selected': node.id === selectedId },
          depth > 1 ? 'preview-q--child' : '',
          `preview-q--type-${node.type}`
        ]"
        :style="depth > 1 ? `margin-left: ${(depth - 1) * 18}px` : ''"
      >
        <div class="preview-q-header">
          <IconDisplay v-if="node.icon" :icon="node.icon" :size="28" />
          <div style="flex:1;min-width:0">
            <div class="q-label">
              {{ node.label }}
              <span v-if="node.required" class="q-required"> *</span>
            </div>
            <div v-if="node.subheading" class="preview-q-subheading">{{ node.subheading }}</div>
          </div>
        </div>

        <div v-if="node.question" class="preview-q-question">{{ node.question }}</div>
        <div v-if="node.helpText" class="q-help">{{ node.helpText }}</div>

        <template v-if="resolveAnswers(node).length">
          <GradientAnswerButtons
            :options="resolveAnswers(node)"
            :defaultIdx="node.defaultIdx"
            :colorScheme="resolveColorScheme(node)"
            :order="resolveAnswerOrder(node)"
          />
        </template>
        <template v-else-if="node.questionType === 'text'">
          <input type="text" disabled placeholder="Freitext-Eingabe..." style="width:100%;opacity:0.5" />
        </template>
        <template v-else-if="node.questionType === 'number'">
          <input type="number" disabled placeholder="0" style="width:120px;opacity:0.5" />
        </template>
        <template v-else-if="node.questionType === 'date'">
          <input type="date" disabled style="opacity:0.5" />
        </template>

        <div v-if="node.reference" class="preview-q-reference">Referenz: {{ node.reference }}</div>

        <div v-if="!isMainVariant" class="rating-section">
          <div v-for="{ key, label } in [
            { key: 'importance', label: 'Wichtigkeit' },
            { key: 'understandability', label: 'Verständlichkeit' }
          ]" :key="key" class="rating-row">
            <span class="rating-label">{{ label }}</span>
            <div class="star-row">
              <button
                v-for="star in 5"
                :key="star"
                class="star-btn"
                :class="{ 'star-btn--active': getNodeRating(node.id, key) >= star }"
                @click="handleRate(node.id, key, star)"
                :title="`${label}: ${star}`"
              >★</button>
            </div>
            <span class="rating-value">{{ getNodeRating(node.id, key) ?? '–' }}</span>
          </div>
        </div>
      </div>

    </template>
    <div v-if="!flatItems.length" style="text-align:center;padding:30px;color:var(--text3);font-size:13px">
      Noch keine Fragen vorhanden.
    </div>
  </div>
</template>
