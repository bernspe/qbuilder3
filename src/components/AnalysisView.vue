<script setup>
import { ref, computed, watch } from 'vue'
import { useAnalysis } from '../composables/useAnalysis.js'
import SunburstChart from './SunburstChart.vue'
import IconDisplay from './IconDisplay.vue'

const props = defineProps({
  variants: { type: Object, required: true },
  baselineId: { type: String, required: true },
  loadAllFromServer: { type: Function, default: null },
})

// User-selectable baseline (defaults to prop, but can be overridden)
const allVariantIds = computed(() => Object.keys(props.variants))
const localBaselineId = ref(props.baselineId)
watch(() => props.baselineId, id => { localBaselineId.value = id })

// Auto-select first variant with sections if baseline has none
watch(allVariantIds, () => {
  const current = props.variants[localBaselineId.value]
  const hasSections = current?.nodes?.some(n => n.type === 'section')
  if (!hasSections) {
    const better = allVariantIds.value.find(id =>
      props.variants[id]?.nodes?.some(n => n.type === 'section')
    )
    if (better) localBaselineId.value = better
  }
}, { immediate: true })

const baselineIdRef = computed(() => localBaselineId.value)
const { variantIds, computeHeatmap } = useAnalysis(props.variants, baselineIdRef)

// Variant selection
const selectedVariants = ref([])
watch(variantIds, ids => {
  selectedVariants.value = [...ids]
}, { immediate: true })

const isReloading = ref(false)
async function reload() {
  if (props.loadAllFromServer) {
    isReloading.value = true
    await props.loadAllFromServer()
    isReloading.value = false
  }
}

const heatmap = computed(() => computeHeatmap(selectedVariants.value))

// Chart interaction – 3 levels: section → question → item
const selectedSectionId = ref(null)
const selectedQuestionId = ref(null)
const selectedNodeId = ref(null)
// Zoom: when set, chart shows only this section (questions inner, items outer)
const zoomedSectionId = ref(null)

function onSelectSection(id) {
  zoomedSectionId.value = id
  selectedSectionId.value = id
  selectedQuestionId.value = null
  selectedNodeId.value = null
}

function resetZoom() {
  zoomedSectionId.value = null
}

function onSelectQuestion({ questionId, sectionId }) {
  selectedSectionId.value = sectionId
  selectedQuestionId.value = questionId
  selectedNodeId.value = null
}

function onSelectNode({ nodeId, questionId, sectionId }) {
  selectedSectionId.value = sectionId
  selectedQuestionId.value = questionId
  selectedNodeId.value = nodeId
}

// Detail panel data
const detailSection = computed(() =>
  heatmap.value.find(s => s.id === selectedSectionId.value) ?? null
)

const detailQuestion = computed(() =>
  detailSection.value?.children.find(q => q.id === selectedQuestionId.value) ?? null
)

const detailNode = computed(() =>
  detailQuestion.value?.children.find(c => c.id === selectedNodeId.value) ?? null
)

// Like functionality (persisted in localStorage)
const LIKES_KEY = 'qb_analysis_likes'
function loadLikes() {
  try { return JSON.parse(localStorage.getItem(LIKES_KEY) ?? '{}') } catch { return {} }
}
const likes = ref(loadLikes())

function toggleLike(variantId) {
  const key = `${selectedNodeId.value ?? selectedQuestionId.value ?? selectedSectionId.value}__${variantId}`
  if (likes.value[key]) {
    delete likes.value[key]
  } else {
    likes.value[key] = true
  }
  likes.value = { ...likes.value }
  try { localStorage.setItem(LIKES_KEY, JSON.stringify(likes.value)) } catch {}
}

function isLiked(variantId) {
  const key = `${selectedNodeId.value ?? selectedQuestionId.value ?? selectedSectionId.value}__${variantId}`
  return !!likes.value[key]
}

// Variant node content for detail panel
function getVariantNode(variantId) {
  if (!selectedNodeId.value) return null
  const nodes = props.variants[variantId]?.nodes ?? []
  return findNode(nodes, selectedNodeId.value)
}

function findNode(list, id) {
  for (const n of list) {
    if (n.id === id) return n
    if (n.children) { const f = findNode(n.children, id); if (f) return f }
    if (n.branches) {
      for (const b of n.branches) {
        if (b.children) { const f = findNode(b.children, id); if (f) return f }
      }
    }
  }
  return null
}

function getBaselineNode(nodeId) {
  const nodes = props.variants[localBaselineId.value]?.nodes ?? []
  return findNode(nodes, nodeId)
}

// All displayable fields with human-readable labels
const ALL_FIELDS = [
  { key: 'label',        label: 'Bezeichnung' },
  { key: 'subheading',   label: 'Unterüberschrift' },
  { key: 'question',     label: 'Frage' },
  { key: 'helpText',     label: 'Hilfetext' },
  { key: 'reference',    label: 'Referenz' },
  { key: 'icfCode',      label: 'ICF-Code' },
  { key: 'questionType', label: 'Fragetyp' },
  { key: 'options',      label: 'Antworten' },
  { key: 'required',     label: 'Pflichtfeld' },
  { key: 'defaultIdx',   label: 'Standard-Antwort' },
  { key: 'answerOrder',  label: 'Antwortreihenfolge' },
]

// Returns only the fields that differ between baseline and variant node
function changedFields(baseNode, varNode) {
  if (!varNode) return ALL_FIELDS.map(f => f.key)
  return ALL_FIELDS
    .filter(f => JSON.stringify(baseNode?.[f.key]) !== JSON.stringify(varNode?.[f.key]))
    .map(f => f.key)
}

function fieldLabel(key) {
  return ALL_FIELDS.find(f => f.key === key)?.label ?? key
}

function fieldDisplay(node, key) {
  const val = node?.[key]
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'boolean') return val ? 'Ja' : 'Nein'
  if (Array.isArray(val)) return val.length ? val.join(' · ') : null
  return String(val)
}

// Legend colors
const legend = [
  { label: 'Keine Änderung', color: '#e2e8f0' },
  { label: 'Wenig', color: '#bfdbfe' },
  { label: 'Mittel', color: '#fde68a' },
  { label: 'Viel', color: '#fb923c' },
  { label: 'Stark', color: '#ef4444' },
]
</script>

<template>
  <div class="analysis-root">
    <!-- Toolbar -->
    <div class="analysis-toolbar">
      <span class="analysis-toolbar-title">Analyse</span>
      <span class="analysis-toolbar-sep"></span>

      <!-- Baseline selector -->
      <span style="font-size:12px;color:var(--text3);margin-right:4px">Original:</span>
      <select
        v-model="localBaselineId"
        style="font-size:12px;padding:2px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg)"
      >
        <option v-for="vid in allVariantIds" :key="vid" :value="vid">
          {{ props.variants[vid]?.label ?? vid }}
        </option>
      </select>

      <span style="width:12px"></span>
      <span style="font-size:12px;color:var(--text3);margin-right:8px">Vergleiche:</span>
      <label
        v-for="vid in variantIds"
        :key="vid"
        class="analysis-variant-check"
      >
        <input
          type="checkbox"
          :value="vid"
          v-model="selectedVariants"
        />
        {{ props.variants[vid]?.label ?? vid }}
      </label>

      <!-- Reload button -->
      <button
        class="btn btn-sm"
        style="margin-left:8px"
        title="Alle Varianten vom Server laden"
        :disabled="isReloading"
        @click="reload"
      >{{ isReloading ? '⏳ Lädt…' : '↺ Vom Server laden' }}</button>

      <span class="analysis-toolbar-sep"></span>
      <!-- Legend -->
      <div class="analysis-legend">
        <span
          v-for="l in legend"
          :key="l.label"
          class="analysis-legend-item"
        >
          <span class="analysis-legend-swatch" :style="{ background: l.color }"></span>
          {{ l.label }}
        </span>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="variantIds.length === 0" class="analysis-empty">
      <div>Noch keine Varianten vorhanden.</div>
      <div style="font-size:13px;color:var(--text3);margin-top:6px">Erstelle zuerst Varianten im Editor-Tab.</div>
    </div>

    <div v-else-if="heatmap.length === 0" class="analysis-empty">
      <div>Der Fragebogen hat noch keine Abschnitte.</div>
    </div>

    <!-- Main layout: chart + detail -->
    <div v-else class="analysis-body">
      <!-- Left: Chart -->
      <div class="analysis-chart-panel">
        <!-- Zoom bar: shown when zoomed into a section -->
        <div v-if="zoomedSectionId" class="analysis-zoom-bar">
          <button class="btn btn-sm" @click="resetZoom">← Alle Abschnitte</button>
          <span class="analysis-zoom-label">{{ heatmap.find(s => s.id === zoomedSectionId)?.label }}</span>
        </div>
        <div v-else style="font-size:11px;color:var(--text3);margin-bottom:8px;text-align:center">
          Klick auf <b>Abschnitt</b> (innen) → hineinzoomen · <b>Screeningfrage/Item</b> → Details
        </div>
        <div class="analysis-chart-wrap">
          <SunburstChart
            :sections="heatmap"
            :selected-section-id="selectedSectionId"
            :selected-question-id="selectedQuestionId"
            :selected-node-id="selectedNodeId"
            :zoomed-section-id="zoomedSectionId"
            @select-section="onSelectSection"
            @select-question="onSelectQuestion"
            @select-node="onSelectNode"
          />
        </div>
        <!-- Section pills below chart -->
        <div class="analysis-section-list">
          <div
            v-for="sec in heatmap"
            :key="sec.id"
            class="analysis-section-pill"
            :class="{ 'analysis-section-pill--active': zoomedSectionId === sec.id }"
            @click="onSelectSection(sec.id)"
          >
            {{ sec.label }}
            <span class="analysis-section-badge">{{ sec.changeCount }}</span>
          </div>
        </div>
      </div>

      <!-- Right: Detail panel -->
      <div class="analysis-detail-panel">
        <!-- No selection -->
        <div v-if="!selectedSectionId" class="analysis-detail-empty">
          Wähle einen Abschnitt, eine Screeningfrage oder ein Item im Chart aus.
        </div>

        <!-- Section selected, no question -->
        <template v-else-if="!selectedQuestionId">
          <div class="analysis-detail-header">
            <span class="analysis-detail-title">{{ detailSection?.label }}</span>
            <span class="analysis-detail-sub">Abschnitt · {{ detailSection?.changeCount }} Änderungen</span>
          </div>
          <div class="analysis-node-list">
            <div
              v-for="q in detailSection?.children ?? []"
              :key="q.id"
              class="analysis-node-row"
              :class="{ 'analysis-node-row--changed': q.changeCount > 0 }"
              @click="onSelectQuestion({ questionId: q.id, sectionId: selectedSectionId })"
            >
              <span class="analysis-node-type-badge type-question">Screeningfrage</span>
              <span class="analysis-node-label">{{ q.label }}</span>
              <span class="analysis-node-changes">{{ q.changeCount }} Änd.</span>
            </div>
            <div v-if="!detailSection?.children?.length" style="color:var(--text3);font-size:13px;padding:16px">
              Keine Screeningfragen in diesem Abschnitt.
            </div>
          </div>
        </template>

        <!-- Question selected, no item -->
        <template v-else-if="!selectedNodeId">
          <div class="analysis-detail-header">
            <button class="btn btn-sm" style="margin-right:8px" @click="selectedQuestionId = null; selectedNodeId = null">← Zurück</button>
            <div>
              <span class="analysis-detail-title">{{ detailQuestion?.label }}</span>
              <span class="analysis-detail-sub">Screeningfrage · {{ detailQuestion?.changeCount }} Änderungen insgesamt</span>
            </div>
          </div>
          <!-- Items under this question -->
          <div class="analysis-node-list">
            <div
              v-for="item in detailQuestion?.children ?? []"
              :key="item.id"
              class="analysis-node-row"
              :class="{ 'analysis-node-row--changed': item.changeCount > 0 }"
              @click="onSelectNode({ nodeId: item.id, questionId: selectedQuestionId, sectionId: selectedSectionId })"
            >
              <span class="analysis-node-type-badge" :class="`type-${item.type}`">{{ item.type }}</span>
              <span class="analysis-node-label">{{ item.label }}</span>
              <span class="analysis-node-changes">{{ item.changeCount }}/{{ item.totalVariants }} Variante(n)</span>
            </div>
            <div v-if="!detailQuestion?.children?.length" style="color:var(--text3);font-size:13px;padding:8px 0">
              Keine Unterfragen / ICF-Items vorhanden.
            </div>
          </div>
        </template>

        <!-- Item selected: per-variant comparison -->
        <template v-else>
          <div class="analysis-detail-header">
            <button class="btn btn-sm" style="margin-right:8px" @click="selectedNodeId = null">← Zurück</button>
            <div>
              <span class="analysis-detail-title">{{ detailNode?.label }}</span>
              <span class="analysis-detail-sub">
                {{ detailNode?.type }} · geändert in {{ detailNode?.changeCount }} von {{ detailNode?.totalVariants }} Variante(n)
              </span>
            </div>
          </div>

          <!-- Baseline: vollständige Darstellung -->
          <div class="analysis-variant-card analysis-variant-card--baseline">
            <div class="analysis-variant-card-header">
              <span class="analysis-variant-name">{{ props.variants[localBaselineId]?.label ?? localBaselineId }}</span>
              <span class="analysis-baseline-badge">Original</span>
            </div>
            <div class="analysis-node-full">
              <!-- Icon -->
              <div v-if="getBaselineNode(selectedNodeId)?.icon" class="analysis-node-icon-row">
                <IconDisplay :icon="getBaselineNode(selectedNodeId).icon" :size="36" />
              </div>
              <!-- ICF Code -->
              <div v-if="getBaselineNode(selectedNodeId)?.icfCode" class="analysis-field-row">
                <span class="analysis-field-key">ICF-Code</span>
                <span class="analysis-field-val analysis-field-code">{{ getBaselineNode(selectedNodeId).icfCode }}</span>
              </div>
              <!-- All textual fields -->
              <template v-for="f in ALL_FIELDS.filter(f => !['icfCode','options','required','defaultIdx','answerOrder'].includes(f.key))" :key="f.key">
                <div v-if="fieldDisplay(getBaselineNode(selectedNodeId), f.key)" class="analysis-field-row">
                  <span class="analysis-field-key">{{ f.label }}</span>
                  <span class="analysis-field-val">{{ fieldDisplay(getBaselineNode(selectedNodeId), f.key) }}</span>
                </div>
              </template>
              <!-- Options -->
              <div v-if="getBaselineNode(selectedNodeId)?.options?.length" class="analysis-field-row">
                <span class="analysis-field-key">Antworten</span>
                <div class="analysis-options-list">
                  <span
                    v-for="(opt, i) in getBaselineNode(selectedNodeId).options"
                    :key="i"
                    class="analysis-option-chip"
                    :class="{ 'analysis-option-chip--default': getBaselineNode(selectedNodeId).defaultIdx === i }"
                  >{{ opt }}</span>
                </div>
              </div>
              <!-- Meta -->
              <div class="analysis-field-row analysis-field-row--meta">
                <span v-if="getBaselineNode(selectedNodeId)?.questionType" class="analysis-meta-chip">{{ getBaselineNode(selectedNodeId).questionType }}</span>
                <span v-if="getBaselineNode(selectedNodeId)?.required" class="analysis-meta-chip analysis-meta-chip--required">Pflichtfeld</span>
                <span v-if="getBaselineNode(selectedNodeId)?.answerOrder" class="analysis-meta-chip">{{ getBaselineNode(selectedNodeId).answerOrder }}</span>
              </div>
            </div>
          </div>

          <!-- Each variant: nur geänderte Felder -->
          <div
            v-for="vid in selectedVariants"
            :key="vid"
            class="analysis-variant-card"
            :class="{ 'analysis-variant-card--changed': detailNode?.variantsChanged.includes(vid) }"
          >
            <div class="analysis-variant-card-header">
              <span class="analysis-variant-name">{{ props.variants[vid]?.label ?? vid }}</span>
              <span v-if="detailNode?.variantsChanged.includes(vid)" class="analysis-changed-badge">geändert</span>
              <span v-else class="analysis-unchanged-badge">unverändert</span>
              <button
                class="analysis-like-btn"
                :class="{ 'analysis-like-btn--active': isLiked(vid) }"
                @click="toggleLike(vid)"
                title="Diese Variante für diesen Punkt liken"
              >{{ isLiked(vid) ? '♥' : '♡' }}</button>
            </div>

            <!-- Unverändert: kurze Meldung -->
            <div v-if="!detailNode?.variantsChanged.includes(vid)" style="font-size:12px;color:var(--text3);padding:2px 0">
              Identisch mit dem Original.
            </div>

            <!-- Node fehlt ganz -->
            <div v-else-if="!getVariantNode(vid)" style="font-size:12px;color:var(--text3);padding:2px 0">
              Node in dieser Variante nicht vorhanden.
            </div>

            <!-- Nur die geänderten Felder anzeigen -->
            <template v-else>
              <div
                v-for="key in changedFields(getBaselineNode(selectedNodeId), getVariantNode(vid))"
                :key="key"
                class="analysis-diff-row"
              >
                <span class="analysis-field-key">{{ fieldLabel(key) }}</span>
                <div class="analysis-diff-values">
                  <!-- Icon-Sonderfall -->
                  <template v-if="key === 'icon'">
                    <div class="analysis-diff-from">
                      <IconDisplay v-if="getBaselineNode(selectedNodeId)?.icon" :icon="getBaselineNode(selectedNodeId).icon" :size="24" />
                      <span v-else style="color:var(--text3)">–</span>
                    </div>
                    <span class="analysis-diff-arrow">→</span>
                    <div class="analysis-diff-to">
                      <IconDisplay v-if="getVariantNode(vid)?.icon" :icon="getVariantNode(vid).icon" :size="24" />
                      <span v-else style="color:var(--text3)">–</span>
                    </div>
                  </template>
                  <!-- Options-Sonderfall -->
                  <template v-else-if="key === 'options'">
                    <div class="analysis-diff-from analysis-options-list">
                      <span v-for="(o,i) in (getBaselineNode(selectedNodeId)?.options ?? [])" :key="i" class="analysis-option-chip">{{ o }}</span>
                      <span v-if="!getBaselineNode(selectedNodeId)?.options?.length" style="color:var(--text3)">–</span>
                    </div>
                    <span class="analysis-diff-arrow">→</span>
                    <div class="analysis-diff-to analysis-options-list">
                      <span v-for="(o,i) in (getVariantNode(vid)?.options ?? [])" :key="i" class="analysis-option-chip analysis-option-chip--new">{{ o }}</span>
                      <span v-if="!getVariantNode(vid)?.options?.length" style="color:var(--text3)">–</span>
                    </div>
                  </template>
                  <!-- Standardfall -->
                  <template v-else>
                    <span class="analysis-diff-from">{{ fieldDisplay(getBaselineNode(selectedNodeId), key) ?? '–' }}</span>
                    <span class="analysis-diff-arrow">→</span>
                    <span class="analysis-diff-to">{{ fieldDisplay(getVariantNode(vid), key) ?? '–' }}</span>
                  </template>
                </div>
              </div>
            </template>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.analysis-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.analysis-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.analysis-toolbar-title {
  font-weight: 700;
  font-size: 13px;
  color: var(--text);
}

.analysis-toolbar-sep {
  flex: 1;
}

.analysis-variant-check {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  cursor: pointer;
}

.analysis-legend {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.analysis-legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text3);
}

.analysis-legend-swatch {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid rgba(0,0,0,0.1);
  flex-shrink: 0;
}

.analysis-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text2);
  font-size: 15px;
}

.analysis-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.analysis-chart-panel {
  width: 45%;
  min-width: 300px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  padding: 12px;
  overflow: hidden;
}

.analysis-chart-wrap {
  flex: 1;
  min-height: 0;
}

.analysis-zoom-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0 8px;
  margin-bottom: 4px;
}

.analysis-zoom-label {
  font-weight: 600;
  font-size: 13px;
  color: var(--text);
}

.analysis-section-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
  margin-top: 8px;
}

.analysis-section-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 12px;
  border: 1px solid var(--border);
  font-size: 11px;
  cursor: pointer;
  background: var(--bg2, #f8fafc);
  transition: background 0.15s;
}

.analysis-section-pill:hover { background: var(--bg3, #e2e8f0); }

.analysis-section-pill--active {
  background: var(--primary, #2563eb);
  color: #fff;
  border-color: var(--primary, #2563eb);
}

.analysis-section-badge {
  background: rgba(0,0,0,0.12);
  border-radius: 8px;
  padding: 0 5px;
  font-size: 10px;
}

.analysis-detail-panel {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.analysis-detail-empty {
  color: var(--text3);
  font-size: 13px;
  text-align: center;
  margin-top: 48px;
}

.analysis-detail-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}

.analysis-detail-title {
  display: block;
  font-weight: 700;
  font-size: 14px;
}

.analysis-detail-sub {
  display: block;
  font-size: 11px;
  color: var(--text3);
  margin-top: 2px;
}

.analysis-node-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.analysis-node-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: var(--radius, 6px);
  border: 1px solid var(--border);
  cursor: pointer;
  font-size: 12px;
  background: var(--bg, #fff);
  transition: background 0.1s;
}

.analysis-node-row:hover { background: var(--bg2, #f8fafc); }
.analysis-node-row--changed { border-left: 3px solid #fb923c; }

.analysis-node-type-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--bg3, #e2e8f0);
  color: var(--text2);
  white-space: nowrap;
}

.type-question { background: #dbeafe; color: #1d4ed8; }
.type-subquestion { background: #dcfce7; color: #15803d; }
.type-icf { background: #fef3c7; color: #92400e; }

.analysis-node-label { flex: 1; }

.analysis-node-changes {
  font-size: 11px;
  color: var(--text3);
  white-space: nowrap;
}

.analysis-variant-card {
  border: 1px solid var(--border);
  border-radius: var(--radius, 6px);
  padding: 10px 12px;
  background: var(--bg, #fff);
}

.analysis-variant-card--baseline {
  background: var(--bg2, #f8fafc);
  border-color: var(--border);
}

.analysis-variant-card--changed {
  border-left: 3px solid #fb923c;
}

.analysis-variant-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.analysis-variant-name {
  font-weight: 600;
  font-size: 13px;
  flex: 1;
}

.analysis-baseline-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: #e0e7ff;
  color: #3730a3;
}

.analysis-changed-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: #ffedd5;
  color: #c2410c;
}

.analysis-unchanged-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: #dcfce7;
  color: #15803d;
}

.analysis-like-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: var(--text3);
  padding: 0 4px;
  line-height: 1;
  transition: color 0.15s, transform 0.1s;
}

.analysis-like-btn:hover { transform: scale(1.2); }
.analysis-like-btn--active { color: #e11d48; }

.analysis-node-fields {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.analysis-field-row {
  display: flex;
  gap: 8px;
  font-size: 12px;
  align-items: baseline;
}

.analysis-field-row--meta {
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.analysis-field-key {
  color: var(--text3);
  min-width: 120px;
  font-size: 11px;
  flex-shrink: 0;
}

.analysis-field-val {
  color: var(--text);
  flex: 1;
}

.analysis-field-code {
  font-family: monospace;
  font-size: 12px;
  background: var(--bg3, #e2e8f0);
  padding: 0 5px;
  border-radius: 4px;
}

.analysis-node-full {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.analysis-node-icon-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.analysis-meta-chip {
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 8px;
  background: var(--bg3, #e2e8f0);
  color: var(--text2);
}

.analysis-meta-chip--required {
  background: #fee2e2;
  color: #b91c1c;
}

.analysis-options-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.analysis-option-chip {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 8px;
  background: var(--bg3, #e2e8f0);
  color: var(--text2);
  border: 1px solid transparent;
}

.analysis-option-chip--default {
  border-color: var(--primary, #2563eb);
  color: var(--primary, #2563eb);
}

.analysis-option-chip--new {
  background: #dcfce7;
  color: #15803d;
}

/* Diff rows in variant cards */
.analysis-diff-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
}

.analysis-diff-row:last-child { border-bottom: none; }

.analysis-diff-values {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;
}

.analysis-diff-from {
  color: var(--text3);
  text-decoration: line-through;
  flex: 1;
  min-width: 80px;
}

.analysis-diff-arrow {
  color: var(--text3);
  flex-shrink: 0;
  font-size: 14px;
}

.analysis-diff-to {
  color: var(--text);
  font-weight: 500;
  flex: 1;
  min-width: 80px;
  background: #fef9c3;
  border-radius: 3px;
  padding: 0 4px;
}
</style>
