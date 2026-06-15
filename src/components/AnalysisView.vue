<script setup>
import { ref, computed, watch, toRef, onMounted, onUnmounted } from 'vue'
import { useAnalysis } from '../composables/useAnalysis.js'
import { useVotingAnalysis } from '../composables/useVotingAnalysis.js'
import { useLikes } from '../composables/useLikes.js'
import { aggregateLikes, createConsensusNodes } from '../composables/useLikeAggregation.js'
import SunburstChart from './SunburstChart.vue'
import VotingScatterChart from './VotingScatterChart.vue'
import IconDisplay from './IconDisplay.vue'

const props = defineProps({
  variants: { type: Object, required: true },
  baselineId: { type: String, required: true },
  loadAllFromServer: { type: Function, default: null },
  // Array of { expertId, likes } from all loaded server variants
  expertLikes: { type: Array, default: () => [] },
  createVariant: { type: Function, default: null },
})

const emit = defineEmits(['create-consensus-variant'])

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
const variantsRef = toRef(props, 'variants')
const { variantIds, computeHeatmap } = useAnalysis(variantsRef, baselineIdRef)
const { ratedNodes, votingMap, summary: votingSummary } = useVotingAnalysis(variantsRef, baselineIdRef)

// Mode: 'changes' | 'votings'
const mode = ref('changes')
// Voting sub-view: 'scatter' | 'sunburst'
const votingSubView = ref('scatter')
// Sunburst color dimension when in voting/sunburst sub-view
const sunburstColorMode = ref('importance')
// Selected node in voting scatter
const selectedVotingId = ref(null)

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
  if (isRunThrough.value) {
    const i = runThroughItems.value.findIndex(it => it.nodeId === nodeId)
    if (i >= 0) runThroughIndex.value = i
  }
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

// Moderator mode (persisted in localStorage)
const isModerator = ref(localStorage.getItem('qb_is_moderator') === '1')
function toggleModerator() {
  isModerator.value = !isModerator.value
  localStorage.setItem('qb_is_moderator', isModerator.value ? '1' : '0')
}

// Like functionality (persisted in localStorage)
const likesMgr = useLikes('qb_analysis_likes')

const activeNodeId = computed(() =>
  selectedNodeId.value ?? selectedQuestionId.value ?? selectedSectionId.value
)

function toggleLike(variantId) {
  likesMgr.toggleLike(activeNodeId.value, variantId)
}

function isLiked(variantId) {
  return likesMgr.isLiked(activeNodeId.value, variantId)
}

// Delphi: aggregate likes from all experts (own + server-loaded)
const allExpertLikes = computed(() => {
  const ownLikes = likesMgr.forExport()
  const own = Object.keys(ownLikes).length > 0
    ? [{ expertId: '__own__', likes: ownLikes }]
    : []
  return [...own, ...props.expertLikes]
})

const aggregatedLikes = computed(() => aggregateLikes(allExpertLikes.value))

const likesCount = computed(() => Object.keys(likesMgr.likes.value).length)

const totalExpertCount = computed(() => {
  const ids = new Set(allExpertLikes.value.map(e => e.expertId))
  return ids.size
})

function likeCountForVariant(nodeId, variantId) {
  return aggregatedLikes.value[nodeId]?.[variantId] ?? 0
}

function consensusForNode(nodeId) {
  return aggregatedLikes.value[nodeId] ?? null
}

function handleCreateConsensusVariant() {
  const baseline = props.variants[localBaselineId.value]
  if (!baseline) return
  const newNodes = createConsensusNodes(baseline.nodes ?? [], aggregatedLikes.value, props.variants)
  const dateStr = new Date().toLocaleDateString('de-DE')
  emit('create-consensus-variant', { nodes: newNodes, label: `Konsens (${dateStr})` })
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

const votingLegend = [
  { label: '1', color: '#ef4444' },
  { label: '2', color: '#fb923c' },
  { label: '3', color: '#fde68a' },
  { label: '4', color: '#86efac' },
  { label: '5', color: '#4ade80' },
]

const selectedVotingNode = computed(() =>
  ratedNodes.value.find(n => n.id === selectedVotingId.value) ?? null
)

// Voting data for the currently selected node/question in the shared detail panel
const currentVotingData = computed(() => {
  const id = selectedNodeId.value ?? selectedQuestionId.value
  if (!id) return null
  return ratedNodes.value.find(n => n.id === id) ?? null
})

const QUADRANT_META = {
  core:    { label: 'Kernthema',          color: '#dcfce7', textColor: '#15803d', hint: 'Beibehalten und weiter optimieren' },
  unclear: { label: 'Optimierungsbedarf', color: '#fef3c7', textColor: '#92400e', hint: 'Wichtig, aber unklar → Formulierung verbessern' },
  nice:    { label: 'Nice-to-have',       color: '#eff6ff', textColor: '#1d4ed8', hint: 'Weniger wichtig → Kürzen erwägen' },
  rethink: { label: 'Überdenken',         color: '#fee2e2', textColor: '#b91c1c', hint: 'Unwichtig und unklar → Streichen oder grundlegend überarbeiten' },
}

// ── Run-Through ──────────────────────────────────────────────────────────────
// Flat list of all leaf items (outermost sunburst ring) in questionnaire order
const runThroughItems = computed(() => {
  const result = []
  for (const section of heatmap.value) {
    for (const question of section.children ?? []) {
      for (const item of question.children ?? []) {
        result.push({ nodeId: item.id, questionId: question.id, sectionId: section.id })
      }
    }
  }
  return result
})

const isRunThrough = ref(false)
const runThroughIndex = ref(0)

function applyRunThroughItem() {
  const item = runThroughItems.value[runThroughIndex.value]
  if (!item) return
  zoomedSectionId.value = item.sectionId
  selectedSectionId.value = item.sectionId
  selectedQuestionId.value = item.questionId
  selectedNodeId.value = item.nodeId
}

function startRunThrough() {
  const startIdx = selectedNodeId.value
    ? Math.max(0, runThroughItems.value.findIndex(it => it.nodeId === selectedNodeId.value))
    : 0
  runThroughIndex.value = startIdx
  isRunThrough.value = true
  applyRunThroughItem()
}

function stopRunThrough() {
  isRunThrough.value = false
}

function rtNext() {
  if (runThroughIndex.value < runThroughItems.value.length - 1) {
    runThroughIndex.value++
    applyRunThroughItem()
  }
}

function rtPrev() {
  if (runThroughIndex.value > 0) {
    runThroughIndex.value--
    applyRunThroughItem()
  }
}

function handleRunThroughKey(e) {
  if (!isRunThrough.value) return
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); rtNext() }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); rtPrev() }
  else if (e.key === 'Escape') { stopRunThrough() }
}

onMounted(() => document.addEventListener('keydown', handleRunThroughKey))
onUnmounted(() => document.removeEventListener('keydown', handleRunThroughKey))
</script>

<template>
  <div class="analysis-root">
    <!-- Toolbar -->
    <div class="analysis-toolbar">
      <span class="analysis-toolbar-title">Analyse</span>

      <!-- Mode toggle -->
      <div class="analysis-mode-toggle">
        <button
          class="analysis-mode-btn"
          :class="{ 'analysis-mode-btn--active': mode === 'changes' }"
          @click="mode = 'changes'"
        >Änderungen</button>
        <button
          class="analysis-mode-btn"
          :class="{ 'analysis-mode-btn--active': mode === 'votings' }"
          @click="mode = 'votings'"
        >Votings</button>
      </div>

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

      <!-- Voting sub-view toggle -->
      <template v-if="mode === 'votings'">
        <div class="analysis-mode-toggle" style="margin-right:8px">
          <button
            class="analysis-mode-btn"
            :class="{ 'analysis-mode-btn--active': votingSubView === 'scatter' }"
            @click="votingSubView = 'scatter'"
          >Scatter</button>
          <button
            class="analysis-mode-btn"
            :class="{ 'analysis-mode-btn--active': votingSubView === 'sunburst' }"
            @click="votingSubView = 'sunburst'"
          >Sunburst</button>
        </div>
        <!-- Sunburst color dimension -->
        <template v-if="votingSubView === 'sunburst'">
          <select
            v-model="sunburstColorMode"
            style="font-size:11px;padding:2px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg);margin-right:8px"
          >
            <option value="importance">Wichtigkeit</option>
            <option value="understandability">Verständlichkeit</option>
          </select>
        </template>
        <!-- Voting legend -->
        <div class="analysis-legend">
          <span style="font-size:11px;color:var(--text3)">Rating:</span>
          <span v-for="l in votingLegend" :key="l.label" class="analysis-legend-item">
            <span class="analysis-legend-swatch" :style="{ background: l.color }"></span>
            {{ l.label }}
          </span>
          <span class="analysis-legend-item" style="margin-left:4px">
            <span class="analysis-legend-swatch" style="background:#e2e8f0"></span>
            kein Rating
          </span>
          <span v-if="votingSummary" style="font-size:11px;color:var(--text3);margin-left:8px">
            {{ votingSummary.totalRated }} Items bewertet
          </span>
        </div>
      </template>

      <!-- Changes legend -->
      <template v-else>
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
      </template>

      <!-- Moderator toggle -->
      <button
        class="btn btn-sm"
        :class="{ 'moderator-btn--active': isModerator }"
        :title="isModerator ? 'Moderator-Modus aktiv – klicken zum Deaktivieren' : 'Moderator-Modus aktivieren'"
        @click="toggleModerator"
      >{{ isModerator ? '👑 Moderator' : '○ Moderator' }}</button>

      <!-- Likes badge -->
      <span v-if="likesCount > 0" class="likes-count-badge" title="Anzahl deiner Likes">♥ {{ likesCount }}</span>

      <!-- Moderator-only actions -->
      <template v-if="isModerator">
        <button
          v-if="Object.keys(aggregatedLikes).length > 0"
          class="btn btn-sm btn-primary"
          title="Konsens-Variante aus Mehrheits-Likes aller Experten erstellen"
          @click="handleCreateConsensusVariant"
        >Konsens-Variante erstellen</button>
        <button
          v-if="likesCount > 0"
          class="btn btn-sm"
          style="color:var(--danger,#b91c1c)"
          title="Eigene Likes zurücksetzen"
          @click="likesMgr.clear()"
        >Likes löschen</button>
      </template>

      <!-- Run-Through: only when sunburst is active and items exist -->
      <template v-if="!(mode === 'votings' && votingSubView === 'scatter') && runThroughItems.length > 0">
        <button
          class="btn btn-sm"
          :class="{ 'rt-btn-active': isRunThrough }"
          :title="isRunThrough ? 'Run-Through beenden (Esc)' : selectedNodeId ? 'Run-Through ab diesem Item starten' : 'Alle Items der Reihe nach durchlaufen (← →)'"
          @click="isRunThrough ? stopRunThrough() : startRunThrough()"
        >{{ isRunThrough ? '⏹ Stopp' : '▶ Run-Through' }}</button>
      </template>
    </div>

    <!-- Empty state -->
    <div v-if="variantIds.length === 0" class="analysis-empty">
      <div>Noch keine Varianten vorhanden.</div>
      <div style="font-size:13px;color:var(--text3);margin-top:6px">Erstelle zuerst Varianten im Editor-Tab.</div>
    </div>

    <div v-else-if="heatmap.length === 0" class="analysis-empty">
      <div>Der Fragebogen hat noch keine Abschnitte.</div>
    </div>

    <!-- ── VOTING SCATTER ──────────────────────────────────────────────────── -->
    <div v-else-if="mode === 'votings' && votingSubView === 'scatter'" class="analysis-body">
      <!-- Left: Scatter chart -->
      <div class="analysis-chart-panel">
        <div style="font-size:11px;color:var(--text3);margin-bottom:8px;text-align:center">
          Klick auf einen <b>Punkt</b> → Details rechts
        </div>
        <div class="analysis-chart-wrap">
          <VotingScatterChart
            :nodes="ratedNodes"
            :selected-id="selectedVotingId"
            @select="selectedVotingId = $event"
          />
        </div>
        <!-- Quadrant summary pills -->
        <div v-if="votingSummary" class="analysis-section-list" style="margin-top:8px">
          <div
            v-for="(count, q) in votingSummary.byQuadrant"
            :key="q"
            class="analysis-section-pill"
            :style="{ background: QUADRANT_META[q].color, borderColor: QUADRANT_META[q].textColor + '55', color: QUADRANT_META[q].textColor }"
          >
            {{ QUADRANT_META[q].label }}
            <span class="analysis-section-badge" :style="{ background: QUADRANT_META[q].textColor + '22' }">{{ count }}</span>
          </div>
        </div>
      </div>

      <!-- Right: Scatter detail -->
      <div class="analysis-detail-panel">
        <!-- Summary (no selection) -->
        <template v-if="!selectedVotingNode">
          <div v-if="!votingSummary" class="analysis-detail-empty">
            Noch keine Bewertungen vorhanden.<br>
            <span style="font-size:11px;margin-top:6px;display:block">Varianten müssen Wichtigkeit- und Verständlichkeit-Ratings enthalten.</span>
          </div>
          <template v-else>
            <div class="analysis-detail-header">
              <div>
                <span class="analysis-detail-title">Voting-Übersicht</span>
                <span class="analysis-detail-sub">{{ votingSummary.totalRated }} bewertete Items aus {{ selectedVariants.length }} Variante(n)</span>
              </div>
            </div>
            <div class="voting-summary-grid">
              <div class="voting-summary-card">
                <div class="voting-summary-num">{{ votingSummary.avgImportance?.toFixed(1) ?? '–' }}</div>
                <div class="voting-summary-label">Ø Wichtigkeit</div>
              </div>
              <div class="voting-summary-card">
                <div class="voting-summary-num">{{ votingSummary.avgUnderstandability?.toFixed(1) ?? '–' }}</div>
                <div class="voting-summary-label">Ø Verständlichkeit</div>
              </div>
            </div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:6px;margin-top:4px">Quadranten-Verteilung</div>
            <div style="display:flex;flex-direction:column;gap:4px">
              <div
                v-for="(count, q) in votingSummary.byQuadrant"
                :key="q"
                class="voting-quadrant-row"
                :style="{ background: QUADRANT_META[q].color, borderColor: QUADRANT_META[q].textColor + '44' }"
              >
                <span :style="{ color: QUADRANT_META[q].textColor, fontWeight: 600, fontSize: '12px' }">{{ QUADRANT_META[q].label }}</span>
                <span style="flex:1;font-size:11px;color:var(--text3);margin-left:8px">{{ QUADRANT_META[q].hint }}</span>
                <span class="analysis-section-badge">{{ count }}</span>
              </div>
            </div>
          </template>
        </template>

        <!-- Node detail (scatter selection) -->
        <template v-else>
          <div class="analysis-detail-header">
            <button class="btn btn-sm" style="margin-right:8px" @click="selectedVotingId = null">← Zurück</button>
            <div>
              <span class="analysis-detail-title">{{ selectedVotingNode.label }}</span>
              <span class="analysis-detail-sub">
                {{ selectedVotingNode.type }} ·
                <span v-if="selectedVotingNode.sectionLabel">{{ selectedVotingNode.sectionLabel }} · </span>
                {{ selectedVotingNode.nRatings }} Bewertung(en)
              </span>
            </div>
          </div>

          <!-- Quadrant badge -->
          <div
            v-if="selectedVotingNode.quadrant"
            class="voting-quadrant-badge"
            :style="{
              background: QUADRANT_META[selectedVotingNode.quadrant].color,
              color: QUADRANT_META[selectedVotingNode.quadrant].textColor,
              borderColor: QUADRANT_META[selectedVotingNode.quadrant].textColor + '55',
            }"
          >
            <span style="font-weight:700">{{ QUADRANT_META[selectedVotingNode.quadrant].label }}</span>
            <span style="font-size:11px;margin-left:8px">{{ QUADRANT_META[selectedVotingNode.quadrant].hint }}</span>
          </div>

          <!-- Average bars -->
          <div v-if="selectedVotingNode.avgImportance !== null" class="voting-avg-row">
            <span class="voting-avg-label">Ø Wichtigkeit</span>
            <div class="voting-bar-wrap">
              <div
                class="voting-bar-fill voting-bar--importance"
                :style="{ width: ((selectedVotingNode.avgImportance - 1) / 4 * 100) + '%' }"
              >{{ selectedVotingNode.avgImportance?.toFixed(1) }}</div>
            </div>
          </div>
          <div v-if="selectedVotingNode.avgUnderstandability !== null" class="voting-avg-row">
            <span class="voting-avg-label">Ø Verständlichkeit</span>
            <div class="voting-bar-wrap">
              <div
                class="voting-bar-fill voting-bar--understand"
                :style="{ width: ((selectedVotingNode.avgUnderstandability - 1) / 4 * 100) + '%' }"
              >{{ selectedVotingNode.avgUnderstandability?.toFixed(1) }}</div>
            </div>
          </div>

          <!-- Histograms -->
          <div v-if="selectedVotingNode.importanceDist?.some(c => c > 0)" class="voting-hist-section">
            <div class="voting-hist-title">Verteilung Wichtigkeit (n={{ selectedVotingNode.importanceDist.reduce((a,b)=>a+b,0) }})</div>
            <div class="voting-hist">
              <div v-for="(count, i) in selectedVotingNode.importanceDist" :key="i" class="voting-hist-col">
                <div class="voting-hist-bar-wrap">
                  <div
                    class="voting-hist-bar voting-hist-bar--importance"
                    :style="{ height: (count / Math.max(...selectedVotingNode.importanceDist) * 100) + '%' }"
                  ></div>
                </div>
                <div class="voting-hist-label">{{ i + 1 }}</div>
                <div class="voting-hist-count">{{ count }}</div>
              </div>
            </div>
          </div>
          <div v-if="selectedVotingNode.understandDist?.some(c => c > 0)" class="voting-hist-section">
            <div class="voting-hist-title">Verteilung Verständlichkeit (n={{ selectedVotingNode.understandDist.reduce((a,b)=>a+b,0) }})</div>
            <div class="voting-hist">
              <div v-for="(count, i) in selectedVotingNode.understandDist" :key="i" class="voting-hist-col">
                <div class="voting-hist-bar-wrap">
                  <div
                    class="voting-hist-bar voting-hist-bar--understand"
                    :style="{ height: (count / Math.max(...selectedVotingNode.understandDist) * 100) + '%' }"
                  ></div>
                </div>
                <div class="voting-hist-label">{{ i + 1 }}</div>
                <div class="voting-hist-count">{{ count }}</div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- ── CHANGES + VOTING SUNBURST (shared body) ────────────────────────── -->
    <div v-else class="analysis-body">
      <!-- Left: Chart -->
      <div class="analysis-chart-panel">
        <!-- Zoom bar: shown when zoomed into a section -->
        <div v-if="zoomedSectionId" class="analysis-zoom-bar">
          <button class="btn btn-sm" @click="resetZoom">← Alle Abschnitte</button>
          <span class="analysis-zoom-label">{{ heatmap.find(s => s.id === zoomedSectionId)?.label }}</span>
        </div>
        <div v-else style="font-size:11px;color:var(--text3);margin-bottom:8px;text-align:center">
          <template v-if="mode === 'votings'">Farbe = Ø {{ sunburstColorMode === 'importance' ? 'Wichtigkeit' : 'Verständlichkeit' }} · Klick zum Zoomen</template>
          <template v-else>Klick auf <b>Abschnitt</b> (innen) → hineinzoomen · <b>Screeningfrage/Item</b> → Details</template>
        </div>
        <div class="analysis-chart-wrap">
          <SunburstChart
            :sections="heatmap"
            :selected-section-id="selectedSectionId"
            :selected-question-id="selectedQuestionId"
            :selected-node-id="selectedNodeId"
            :zoomed-section-id="zoomedSectionId"
            :color-mode="mode === 'votings' ? sunburstColorMode : 'changes'"
            :voting-map="mode === 'votings' ? votingMap : {}"
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
            <span v-if="sec.isAdded" class="analysis-new-badge">NEU</span>
            <span class="analysis-section-badge">{{ sec.changeCount }}</span>
          </div>
        </div>
      </div>

      <!-- Right: Detail panel -->
      <div class="analysis-detail-panel">
        <!-- Run-Through Navigator -->
        <div v-if="isRunThrough" class="rt-nav">
          <div class="rt-nav-top">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:11px;font-weight:600;color:var(--primary,#2563eb)">▶ Run-Through</span>
              <span class="rt-nav-count">{{ runThroughIndex + 1 }} / {{ runThroughItems.length }}</span>
            </div>
            <button class="btn btn-sm" style="font-size:11px" @click="stopRunThrough()">✕ Beenden</button>
          </div>
          <div class="rt-progress-track">
            <div class="rt-progress-fill" :style="{ width: ((runThroughIndex + 1) / runThroughItems.length * 100) + '%' }"></div>
          </div>
          <div class="rt-nav-controls">
            <button
              class="btn btn-sm"
              :disabled="runThroughIndex === 0"
              :style="runThroughIndex === 0 ? { opacity: 0.4 } : {}"
              @click="rtPrev()"
            >← Zurück</button>
            <button
              class="btn btn-sm rt-next-btn"
              :disabled="runThroughIndex >= runThroughItems.length - 1"
              :style="runThroughIndex >= runThroughItems.length - 1 ? { opacity: 0.4 } : {}"
              @click="rtNext()"
            >Weiter →</button>
          </div>
          <div class="rt-kb-hint">← → navigieren · Esc beendet</div>
        </div>

        <!-- No selection -->
        <div v-if="!selectedSectionId && !isRunThrough" class="analysis-detail-empty">
          Wähle einen Abschnitt, eine Screeningfrage oder ein Item im Chart aus.
        </div>

        <!-- Section selected, no question -->
        <template v-else-if="!selectedQuestionId">
          <div class="analysis-detail-header">
            <span class="analysis-detail-title">{{ detailSection?.label }}</span>
            <span class="analysis-detail-sub">
              Abschnitt · {{ detailSection?.changeCount }} Änderungen
              <template v-if="detailSection?.isAdded"> · Neu in: {{ detailSection.addedIn.map(id => props.variants[id]?.label ?? id).join(', ') }}</template>
            </span>
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
              <span v-if="q.isAdded" class="analysis-new-badge">NEU</span>
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
              <span class="analysis-detail-sub">
                Screeningfrage · {{ detailQuestion?.changeCount }} Änderungen insgesamt
                <template v-if="detailQuestion?.isAdded"> · Neu in: {{ detailQuestion.addedIn.map(id => props.variants[id]?.label ?? id).join(', ') }}</template>
              </span>
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
              <span v-if="item.isAdded" class="analysis-new-badge">NEU</span>
              <span class="analysis-node-changes">{{ item.changeCount }}/{{ item.totalVariants }} Variante(n)</span>
              <!-- Delphi consensus indicator -->
              <span
                v-if="consensusForNode(item.id)"
                class="delphi-dot"
                :class="{
                  'delphi-dot--consensus': consensusForNode(item.id).majority,
                  'delphi-dot--controversial': consensusForNode(item.id).isControversial,
                  'delphi-dot--partial': !consensusForNode(item.id).majority && !consensusForNode(item.id).isControversial,
                }"
                :title="consensusForNode(item.id).majority
                  ? `Konsens: ${Math.round(consensusForNode(item.id).consensusRatio * 100)}% bevorzugen ${props.variants[consensusForNode(item.id).majority]?.label ?? consensusForNode(item.id).majority}`
                  : `Strittig: ${consensusForNode(item.id).total} Stimme(n), keine Einigkeit`"
              ></span>
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
                {{ detailNode?.type }} ·
                <template v-if="detailNode?.isAdded">neu in {{ detailNode.addedIn.length }} von {{ detailNode.totalVariants }} Variante(n)</template>
                <template v-else>geändert in {{ detailNode?.changeCount }} von {{ detailNode?.totalVariants }} Variante(n)</template>
              </span>
            </div>
          </div>

          <!-- Baseline: vollständige Darstellung -->
          <div class="analysis-variant-card analysis-variant-card--baseline">
            <div class="analysis-variant-card-header">
              <span class="analysis-variant-name">{{ props.variants[localBaselineId]?.label ?? localBaselineId }}</span>
              <span class="analysis-baseline-badge">Original</span>
            </div>
            <div v-if="detailNode?.isAdded" style="font-size:12px;color:var(--text3);font-style:italic;padding:4px 0">
              Nicht im Original vorhanden.
            </div>
            <div v-else class="analysis-node-full">
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

          <!-- Each variant -->
          <div
            v-for="vid in selectedVariants"
            :key="vid"
            class="analysis-variant-card"
            :class="{ 'analysis-variant-card--changed': detailNode?.isAdded ? detailNode.addedIn.includes(vid) : detailNode?.variantsChanged.includes(vid) }"
          >
            <div class="analysis-variant-card-header">
              <span class="analysis-variant-name">{{ props.variants[vid]?.label ?? vid }}</span>
              <!-- isAdded: zeige ob diese Variante den neuen Node enthält -->
              <template v-if="detailNode?.isAdded">
                <span v-if="detailNode.addedIn.includes(vid)" class="analysis-added-badge">neu hinzugefügt</span>
                <span v-else class="analysis-unchanged-badge">nicht vorhanden</span>
                <template v-if="detailNode.addedIn.includes(vid)">
                  <span v-if="likeCountForVariant(selectedNodeId, vid) > 0" class="delphi-like-count">{{ likeCountForVariant(selectedNodeId, vid) }}/{{ totalExpertCount }}</span>
                  <button
                    class="analysis-like-btn"
                    :class="{ 'analysis-like-btn--active': isLiked(vid) }"
                    @click="toggleLike(vid)"
                    :title="`${likeCountForVariant(selectedNodeId, vid)} von ${totalExpertCount} Experten bevorzugen diese Variante`"
                  >{{ isLiked(vid) ? '♥' : '♡' }}</button>
                </template>
              </template>
              <!-- Normal: geändert / unverändert + Like -->
              <template v-else>
                <span v-if="detailNode?.variantsChanged.includes(vid)" class="analysis-changed-badge">geändert</span>
                <span v-else class="analysis-unchanged-badge">unverändert</span>
                <span v-if="likeCountForVariant(selectedNodeId, vid) > 0" class="delphi-like-count">{{ likeCountForVariant(selectedNodeId, vid) }}/{{ totalExpertCount }}</span>
                <button
                  class="analysis-like-btn"
                  :class="{ 'analysis-like-btn--active': isLiked(vid) }"
                  @click="toggleLike(vid)"
                  :title="`${likeCountForVariant(selectedNodeId, vid)} von ${totalExpertCount} Experten bevorzugen diese Variante`"
                >{{ isLiked(vid) ? '♥' : '♡' }}</button>
              </template>
            </div>

            <!-- isAdded: volle Darstellung des neuen Nodes aus der Variante -->
            <template v-if="detailNode?.isAdded">
              <template v-if="detailNode.addedIn.includes(vid)">
                <div class="analysis-node-full">
                  <div v-if="getVariantNode(vid)?.icon" class="analysis-node-icon-row">
                    <IconDisplay :icon="getVariantNode(vid).icon" :size="36" />
                  </div>
                  <div v-if="getVariantNode(vid)?.icfCode" class="analysis-field-row">
                    <span class="analysis-field-key">ICF-Code</span>
                    <span class="analysis-field-val analysis-field-code">{{ getVariantNode(vid).icfCode }}</span>
                  </div>
                  <template v-for="f in ALL_FIELDS.filter(f => !['icfCode','options','required','defaultIdx','answerOrder'].includes(f.key))" :key="f.key">
                    <div v-if="fieldDisplay(getVariantNode(vid), f.key)" class="analysis-field-row">
                      <span class="analysis-field-key">{{ f.label }}</span>
                      <span class="analysis-field-val">{{ fieldDisplay(getVariantNode(vid), f.key) }}</span>
                    </div>
                  </template>
                  <div v-if="getVariantNode(vid)?.options?.length" class="analysis-field-row">
                    <span class="analysis-field-key">Antworten</span>
                    <div class="analysis-options-list">
                      <span v-for="(opt, i) in getVariantNode(vid).options" :key="i" class="analysis-option-chip analysis-option-chip--new">{{ opt }}</span>
                    </div>
                  </div>
                  <div class="analysis-field-row analysis-field-row--meta">
                    <span v-if="getVariantNode(vid)?.questionType" class="analysis-meta-chip">{{ getVariantNode(vid).questionType }}</span>
                    <span v-if="getVariantNode(vid)?.required" class="analysis-meta-chip analysis-meta-chip--required">Pflichtfeld</span>
                    <span v-if="getVariantNode(vid)?.answerOrder" class="analysis-meta-chip">{{ getVariantNode(vid).answerOrder }}</span>
                  </div>
                </div>
              </template>
              <div v-else style="font-size:12px;color:var(--text3);padding:2px 0">
                Nicht in dieser Variante hinzugefügt.
              </div>
            </template>

            <!-- Normal: Diff-Darstellung -->
            <template v-else>
              <div v-if="!detailNode?.variantsChanged.includes(vid)" style="font-size:12px;color:var(--text3);padding:2px 0">
                Identisch mit dem Original.
              </div>
              <div v-else-if="!getVariantNode(vid)" style="font-size:12px;color:var(--text3);padding:2px 0">
                Node in dieser Variante nicht vorhanden.
              </div>
              <template v-else>
                <div
                  v-for="key in changedFields(getBaselineNode(selectedNodeId), getVariantNode(vid))"
                  :key="key"
                  class="analysis-diff-row"
                >
                  <span class="analysis-field-key">{{ fieldLabel(key) }}</span>
                  <div class="analysis-diff-values">
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
                    <template v-else>
                      <span class="analysis-diff-from">{{ fieldDisplay(getBaselineNode(selectedNodeId), key) ?? '–' }}</span>
                      <span class="analysis-diff-arrow">→</span>
                      <span class="analysis-diff-to">{{ fieldDisplay(getVariantNode(vid), key) ?? '–' }}</span>
                    </template>
                  </div>
                </div>
              </template>
            </template>
          </div>
        </template>

        <!-- Voting info addon: shown for both changes mode and voting+sunburst when ratings exist -->
        <div v-if="currentVotingData" class="voting-detail-section">
          <div class="voting-detail-divider">Voting-Daten</div>
          <div
            v-if="currentVotingData.quadrant"
            class="voting-quadrant-badge"
            :style="{
              background: QUADRANT_META[currentVotingData.quadrant].color,
              color: QUADRANT_META[currentVotingData.quadrant].textColor,
              borderColor: QUADRANT_META[currentVotingData.quadrant].textColor + '55',
            }"
          >
            <span style="font-weight:700">{{ QUADRANT_META[currentVotingData.quadrant].label }}</span>
            <span style="font-size:11px;margin-left:8px">{{ QUADRANT_META[currentVotingData.quadrant].hint }}</span>
          </div>
          <div v-if="currentVotingData.avgImportance !== null" class="voting-avg-row">
            <span class="voting-avg-label">Ø Wichtigkeit</span>
            <div class="voting-bar-wrap">
              <div
                class="voting-bar-fill voting-bar--importance"
                :style="{ width: ((currentVotingData.avgImportance - 1) / 4 * 100) + '%' }"
              >{{ currentVotingData.avgImportance?.toFixed(1) }}</div>
            </div>
          </div>
          <div v-if="currentVotingData.avgUnderstandability !== null" class="voting-avg-row">
            <span class="voting-avg-label">Ø Verständlichkeit</span>
            <div class="voting-bar-wrap">
              <div
                class="voting-bar-fill voting-bar--understand"
                :style="{ width: ((currentVotingData.avgUnderstandability - 1) / 4 * 100) + '%' }"
              >{{ currentVotingData.avgUnderstandability?.toFixed(1) }}</div>
            </div>
          </div>
          <div v-if="currentVotingData.importanceDist?.some(c => c > 0)" class="voting-hist-section">
            <div class="voting-hist-title">Verteilung Wichtigkeit (n={{ currentVotingData.importanceDist.reduce((a,b)=>a+b,0) }})</div>
            <div class="voting-hist">
              <div v-for="(count, i) in currentVotingData.importanceDist" :key="i" class="voting-hist-col">
                <div class="voting-hist-bar-wrap">
                  <div
                    class="voting-hist-bar voting-hist-bar--importance"
                    :style="{ height: (count / Math.max(...currentVotingData.importanceDist) * 100) + '%' }"
                  ></div>
                </div>
                <div class="voting-hist-label">{{ i + 1 }}</div>
                <div class="voting-hist-count">{{ count }}</div>
              </div>
            </div>
          </div>
          <div v-if="currentVotingData.understandDist?.some(c => c > 0)" class="voting-hist-section">
            <div class="voting-hist-title">Verteilung Verständlichkeit (n={{ currentVotingData.understandDist.reduce((a,b)=>a+b,0) }})</div>
            <div class="voting-hist">
              <div v-for="(count, i) in currentVotingData.understandDist" :key="i" class="voting-hist-col">
                <div class="voting-hist-bar-wrap">
                  <div
                    class="voting-hist-bar voting-hist-bar--understand"
                    :style="{ height: (count / Math.max(...currentVotingData.understandDist) * 100) + '%' }"
                  ></div>
                </div>
                <div class="voting-hist-label">{{ i + 1 }}</div>
                <div class="voting-hist-count">{{ count }}</div>
              </div>
            </div>
          </div>
        </div>
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

.analysis-new-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: #dcfce7;
  color: #15803d;
  font-weight: 600;
  flex-shrink: 0;
}

.analysis-added-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: #dcfce7;
  color: #15803d;
  font-weight: 600;
}

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

/* ── Mode toggle ────────────────────────────────────────────────────────── */
.analysis-mode-toggle {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
}

.analysis-mode-btn {
  padding: 3px 12px;
  font-size: 12px;
  font-weight: 500;
  background: var(--bg2, #f8fafc);
  color: var(--text3);
  border: none;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  white-space: nowrap;
}

.analysis-mode-btn:not(:last-child) {
  border-right: 1px solid var(--border);
}

.analysis-mode-btn--active {
  background: var(--primary, #2563eb);
  color: #fff;
}

/* ── Voting detail panel ─────────────────────────────────────────────────── */
.voting-summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 4px;
}

.voting-summary-card {
  background: var(--bg2, #f8fafc);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  text-align: center;
}

.voting-summary-num {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
}

.voting-summary-label {
  font-size: 10px;
  color: var(--text3);
  margin-top: 2px;
}

.voting-quadrant-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  font-size: 11px;
}

.voting-quadrant-badge {
  border-radius: 8px;
  padding: 8px 12px;
  border: 1px solid transparent;
  font-size: 12px;
  margin-bottom: 4px;
}

.voting-avg-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.voting-avg-label {
  color: var(--text3);
  width: 120px;
  font-size: 11px;
  flex-shrink: 0;
}

.voting-bar-wrap {
  flex: 1;
  background: var(--bg2, #f1f5f9);
  border-radius: 6px;
  height: 16px;
  overflow: hidden;
}

.voting-bar-fill {
  height: 100%;
  border-radius: 6px;
  display: flex;
  align-items: center;
  padding-left: 6px;
  font-size: 10px;
  color: #fff;
  font-weight: 600;
  min-width: 28px;
  transition: width 0.3s;
}

.voting-bar--importance  { background: #2563eb; }
.voting-bar--understand  { background: #16a34a; }

.voting-hist-section {
  margin-top: 4px;
}

.voting-hist-title {
  font-size: 11px;
  color: var(--text3);
  margin-bottom: 6px;
}

.voting-hist {
  display: flex;
  gap: 6px;
  align-items: flex-end;
  height: 60px;
}

.voting-hist-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  gap: 2px;
  height: 100%;
}

.voting-hist-bar-wrap {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  background: var(--bg2, #f1f5f9);
  border-radius: 3px 3px 0 0;
  overflow: hidden;
}

.voting-hist-bar {
  width: 100%;
  border-radius: 3px 3px 0 0;
  min-height: 2px;
  transition: height 0.3s;
}

.voting-hist-bar--importance { background: #93c5fd; }
.voting-hist-bar--understand { background: #86efac; }

.voting-hist-label {
  font-size: 9px;
  color: var(--text3);
  line-height: 1;
}

.voting-hist-count {
  font-size: 9px;
  color: var(--text2);
  font-weight: 600;
  line-height: 1;
}

.voting-detail-section {
  border-top: 2px solid var(--border);
  margin-top: 6px;
  padding-top: 10px;
}

.voting-detail-divider {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text3);
  margin-bottom: 8px;
}

/* ── Run-Through ─────────────────────────────────────────────────────────── */
.rt-nav {
  background: var(--bg2, #f8fafc);
  border: 1px solid var(--border);
  border-radius: var(--radius, 6px);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.rt-nav-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rt-nav-count {
  font-size: 11px;
  color: var(--text3);
}

.rt-progress-track {
  height: 4px;
  background: var(--bg3, #e2e8f0);
  border-radius: 2px;
  overflow: hidden;
}

.rt-progress-fill {
  height: 100%;
  background: var(--primary, #2563eb);
  border-radius: 2px;
  transition: width 0.2s;
}

.rt-nav-controls {
  display: flex;
  gap: 8px;
}

.rt-nav-controls .btn {
  flex: 1;
  justify-content: center;
}

.rt-next-btn {
  font-weight: 600;
}

.rt-kb-hint {
  font-size: 10px;
  color: var(--text3);
  text-align: center;
  letter-spacing: 0.02em;
}

.rt-btn-active {
  background: var(--primary, #2563eb) !important;
  color: #fff !important;
  border-color: var(--primary, #2563eb) !important;
}

/* ── Moderator ───────────────────────────────────────────────────────────────*/
.moderator-btn--active {
  background: #fef3c7 !important;
  color: #92400e !important;
  border-color: #d97706 !important;
  font-weight: 600;
}

/* ── Delphi / Likes ──────────────────────────────────────────────────────────*/
.likes-count-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  background: #fce7f3;
  color: #9d174d;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.delphi-like-count {
  font-size: 10px;
  color: #9d174d;
  font-weight: 600;
  margin-right: 2px;
}

.delphi-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-left: 4px;
}

.delphi-dot--consensus  { background: #16a34a; }
.delphi-dot--controversial { background: #dc2626; }
.delphi-dot--partial    { background: #d97706; }
</style>
