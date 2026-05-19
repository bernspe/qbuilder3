<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRefHistory } from '@vueuse/core'
import { useQuestionnaire } from './composables/useQuestionnaire.js'
import { useGamification } from './composables/useGamification.js'
import { useAutosave } from './composables/useAutosave.js'
import { useToast } from './composables/useToast.js'
import { VueDraggable } from 'vue-draggable-plus'
import TreeNode from './components/TreeNode.vue'
import NodeEditor from './components/NodeEditor.vue'
import PreviewPanel from './components/PreviewPanel.vue'
import MergeModal from './components/MergeModal.vue'
import ImportModal from './components/ImportModal.vue'
import OnboardingModal from './components/OnboardingModal.vue'
import AnalysisView from './components/AnalysisView.vue'

const qb = useQuestionnaire()
const gamification = useGamification()
const { toasts, show: showToast } = useToast()

const selectedId = ref(null)
const showMerge = ref(false)
const showImport = ref(false)
const showOnboarding = ref(!localStorage.getItem('qb_onboarding_seen'))
function closeOnboarding() {
  showOnboarding.value = false
  localStorage.setItem('qb_onboarding_seen', '1')
}
const ratingCount = computed(() => {
  const vr = gamification.ratings[qb.currentVariant.value] ?? {}
  return Object.values(vr).filter(r => r.importance !== null && r.understandability !== null).length
})
const activeTab = ref('editor')

// ── Mobile panel navigation ─────────────────────────────────────────────────
const PANELS = ['structure', 'content', 'variants']
const activePanel = ref('content')

let swipeStartX = 0
function onSwipeStart(e) { swipeStartX = e.touches[0].clientX }
function onSwipeEnd(e) {
  const dx = e.changedTouches[0].clientX - swipeStartX
  if (Math.abs(dx) < 50) return
  const idx = PANELS.indexOf(activePanel.value)
  if (dx < 0 && idx < PANELS.length - 1) activePanel.value = PANELS[idx + 1]
  if (dx > 0 && idx > 0) activePanel.value = PANELS[idx - 1]
}

// ── JSON-Editor ────────────────────────────────────────────────────────────
const jsonEditContent = ref('')
const jsonParseError = ref('')
const jsonTextareaRef = ref(null)
const jsonScrollTop   = ref(0)
const jsonStripeTopPx = ref(null)   // px vom Inhaltsbeginn (inkl. padding)
const jsonStripeHtPx  = ref(0)
let isApplyingJson = false

// Mirror-Div-Technik: misst exakte Pixel-Y eines Zeichens inkl. Soft-Wraps
function getCharOffsetTop(textarea, charPos) {
  const cs  = getComputedStyle(textarea)
  const div = document.createElement('div')
  ;['fontFamily','fontSize','fontWeight','fontStyle','lineHeight',
    'paddingTop','paddingRight','paddingBottom','paddingLeft',
    'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth',
    'boxSizing','letterSpacing','tabSize'].forEach(p => { div.style[p] = cs[p] })
  div.style.position    = 'absolute'
  div.style.visibility  = 'hidden'
  div.style.top         = '0'
  div.style.left        = '0'
  div.style.width       = textarea.clientWidth + 'px'
  div.style.whiteSpace  = 'pre-wrap'
  div.style.overflowWrap = 'break-word'
  div.style.wordBreak   = 'normal'
  div.style.height      = 'auto'
  div.style.overflow    = 'hidden'
  div.textContent = textarea.value.substring(0, charPos)
  const span = document.createElement('span')
  span.textContent = '\u200b'
  div.appendChild(span)
  document.body.appendChild(div)
  const top = span.offsetTop
  document.body.removeChild(div)
  return top
}

// Findet { start, end } des Node-Objekts per ID im JSON-String,
// eingeschränkt auf die aktuelle Variante damit geklonte IDs nicht zu
// einer falschen Variante führen.
function findNodeCharRange(json, nodeId, variantId) {
  // Suche zuerst die Varianten-Sektion, dann die Node-ID darin
  const variantKey = `"${variantId}": {`
  const variantStart = json.indexOf(variantKey)
  const searchFrom = variantStart >= 0 ? variantStart : 0
  const searchStr = `"id": "${nodeId}"`
  const pos = json.indexOf(searchStr, searchFrom)
  if (pos < 0) return null
  let depth = 0, start = pos
  while (start > 0) {
    start--
    if (json[start] === '}') depth++
    else if (json[start] === '{') { if (depth === 0) break; depth-- }
  }
  depth = 0
  let end = start
  while (end < json.length) {
    if (json[end] === '{') depth++
    else if (json[end] === '}') { depth--; if (depth === 0) { end++; break } }
    end++
  }
  return { start, end, idPos: pos, searchStr }
}

// Stripe-Position relativ zur Wrapper-Oberkante (durch scrollTop verschoben)
const jsonStripeStyle = computed(() => {
  if (jsonStripeTopPx.value === null) return null
  return {
    top:    `${jsonStripeTopPx.value - jsonScrollTop.value}px`,
    height: `${jsonStripeHtPx.value}px`
  }
})

function syncJsonScroll(e) {
  jsonScrollTop.value = e.target.scrollTop
}

qb.loadFromStorage()
gamification.loadRatingsFromStorage()

const selectedNode = computed(() => {
  if (!selectedId.value) return null
  return qb.findInVariant(selectedId.value)
})
const selectedNodeType = computed(() => selectedNode.value?.type ?? null)

const baselineVariantId = computed(() => qb.variantList.value[0]?.id)
const isMainVariant = computed(() => qb.currentVariant.value === baselineVariantId.value)

const variantPoints = ref({})
watch(
  [() => qb.variants, gamification.ratings],
  () => {
    const result = {}
    for (const v of qb.variantList.value) {
      if (v.id !== baselineVariantId.value) {
        result[v.id] = gamification.calculatePoints(qb.variants, v.id)
      }
    }
    variantPoints.value = result
  },
  { deep: true, immediate: true }
)

const ratedNodeIds = computed(() => {
  const id = qb.currentVariant.value
  if (id === 'main') return new Set()
  return new Set(
    Object.entries(gamification.ratings[id] ?? {})
      .filter(([, r]) => r.importance !== null && r.understandability !== null)
      .map(([nodeId]) => nodeId)
  )
})

const stats = computed(() => qb.countAll())
const jsonPreview = computed(() => qb.exportJSON())

const ratingStats = computed(() => {
  const variantId = qb.currentVariant.value
  const total = stats.value.q + stats.value.sq + stats.value.icf
  if (isMainVariant.value || total === 0) return null
  const done = Object.values(gamification.ratings[variantId] ?? {})
    .filter(r => r.importance !== null && r.understandability !== null).length
  return { done, total, todo: total - done }
})

const tabs = [
  { id: 'editor', label: 'Editor' },
  { id: 'preview', label: 'Vorschau' },
  { id: 'json', label: 'JSON' },
  { id: 'analyse', label: '📊 Analyse' },
]

// Sync JSON-Editor-Inhalt wenn Tab gewechselt oder Daten geändert werden
watch(activeTab, (tab) => {
  if (tab === 'json') jsonEditContent.value = jsonPreview.value
  if (tab === 'analyse') loadAllVariantsForAnalysis()
})
watch(jsonPreview, (val) => {
  if (!isApplyingJson) jsonEditContent.value = val
})

function handleJsonInput() {
  const raw = jsonEditContent.value
  try {
    const parsed = JSON.parse(raw)
    if (!parsed.variants) { jsonParseError.value = 'Fehlende "variants"-Eigenschaft'; return }
    jsonParseError.value = ''
    isApplyingJson = true
    Object.keys(qb.variants).forEach(k => delete qb.variants[k])
    Object.assign(qb.variants, parsed.variants)
    if (!qb.variants[qb.currentVariant.value]) {
      qb.currentVariant.value = Object.keys(qb.variants)[0]
    }
    nextTick(() => { isApplyingJson = false })
  } catch (err) {
    jsonParseError.value = err.message
  }
}

function handleJsonKeyDown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault(); doUndo()
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault(); doRedo()
  }
}

// Scroll + Stripe beim Wechsel der selektierten Node oder des JSON-Tabs
watch([selectedId, activeTab], async ([id, tab]) => {
  if (tab !== 'json' || !id) {
    jsonStripeTopPx.value = null
    return
  }
  await nextTick()
  const textarea = jsonTextareaRef.value
  if (!textarea) return
  const json = jsonEditContent.value
  const range = findNodeCharRange(json, id, qb.currentVariant.value)
  if (!range) { jsonStripeTopPx.value = null; return }

  // Pixel-genaue Y-Positionen via Mirror-Div (inkl. Soft-Wraps)
  const startY = getCharOffsetTop(textarea, range.start)
  const endY   = getCharOffsetTop(textarea, range.end)
  const lh = parseFloat(getComputedStyle(textarea).lineHeight) || 16.5
  jsonStripeTopPx.value = startY
  jsonStripeHtPx.value  = Math.max(lh, endY - startY + lh)

  // Scroll so, dass der Block etwa 3 Zeilen vom oberen Rand erscheint
  const scrollTop = Math.max(0, startY - lh * 3)
  textarea.scrollTop   = scrollTop
  jsonScrollTop.value  = scrollTop

  try { textarea.setSelectionRange(range.idPos, range.idPos + range.searchStr.length) } catch (_) {}
})

// ── Undo/Redo ──────────────────────────────────────────────────────────────
const snapshot = ref(JSON.stringify(qb.variants))
let isUndoRedo = false

watch(
  () => JSON.stringify(qb.variants),
  (val) => { if (!isUndoRedo) snapshot.value = val },
  { deep: true }
)

const { undo: undoHistory, redo: redoHistory, canUndo, canRedo } =
  useRefHistory(snapshot, { capacity: 50 })

watch(snapshot, (val) => {
  if (!isUndoRedo) return
  const parsed = JSON.parse(val)
  Object.keys(qb.variants).forEach(k => delete qb.variants[k])
  Object.assign(qb.variants, parsed)
})

function doUndo() {
  if (!canUndo.value) return
  isUndoRedo = true
  undoHistory()
  nextTick(() => { isUndoRedo = false })
}

function doRedo() {
  if (!canRedo.value) return
  isUndoRedo = true
  redoHistory()
  nextTick(() => { isUndoRedo = false })
}

function handleKeyDown(e) {
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    doUndo()
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault()
    doRedo()
  }
}
onMounted(async () => {
  document.addEventListener('keydown', handleKeyDown)

  // Erster Start: kein localStorage → VITE_ON_STARTUP laden
  const onStartup = import.meta.env.VITE_ON_STARTUP ?? ''
  const isFirstStart = !localStorage.getItem('qb_vue3_data')
  if (isFirstStart && onStartup) {
    try {
      const res = await fetch(`${uploadServer}/php/get_original.php`)
      if (res.ok) {
        const raw = await res.text()
        qb.importJSON(raw)
      }
    } catch (_) {}
  }

  // Conflict check: für jede serververlinkte Variante prüfen ob Server neuer ist
  for (const v of qb.variantList.value) {
    if (!autosave.isLinked(v.id)) continue
    try {
      const { newer, serverTimestamp } = await autosave.checkServerVersion(v.id)
      if (!newer) continue
      const local = autosave.getSavedAt(v.id)
      const ok = confirm(
        `Variante "${v.label}" hat eine neuere Version auf dem Server (${serverTimestamp?.slice(0, 10)}).\n` +
        `Lokal: ${local?.slice(0, 10) ?? '–'}\n\n` +
        `Server-Version laden? (Nein = lokale Version behalten)`
      )
      if (ok) {
        const res = await fetch(`${uploadServer}/php/get_variant.php?name=${encodeURIComponent(v.id)}`)
        const raw = await res.text()
        const parsed = JSON.parse(raw)
        qb.importJSON(raw, v.id)
        if (parsed.ratings) gamification.restoreVariantRatings(v.id, parsed.ratings)
        autosave.recordSave(v.id, parsed.exportedAt)
        autosave.setStatus(v.id, 'saved', parsed.exportedAt)
        showToast(`Variante "${v.id}" vom Server geladen`)
      }
    } catch (_) {}
  }
})
onUnmounted(() => document.removeEventListener('keydown', handleKeyDown))
// ──────────────────────────────────────────────────────────────────────────

function selectNode(id) {
  selectedId.value = id
}

function handleDelete(id) {
  qb.deleteNode(id)
  if (selectedId.value === id) selectedId.value = null
}

function handleUpdate({ id, field, value }) {
  const node = qb.findInVariant(id)
  if (node) node[field] = value
}

function handleAddChild({ type, parentId }) {
  const node = qb.addNode(type, parentId)
  // Auto-fill subheading with parent's label
  if (type === 'subquestion' && parentId) {
    const parent = qb.findInVariant(parentId)
    if (parent) node.subheading = parent.label
  }
  selectedId.value = node.id
}

function handleAddRoot(type) {
  const node = qb.addNode(type, null)
  // Auto-create Screeningfrage when a new Abschnitt is added
  if (type === 'section') {
    const q = qb.addNode('question', node.id)
    selectedId.value = q.id
  } else {
    selectedId.value = node.id
  }
}

async function handleDeleteVariant(id) {
  const wasLinked = autosave.isLinked(id)
  if (!qb.deleteVariant(id)) return
  gamification.purgeVariantRatings(id)
  autosave.purgeLinked(id)
  if (wasLinked) autosave.deleteFromServer(id)
  showToast('Variante gelöscht')
}

function handleRate({ nodeId, type, value }) {
  if (isMainVariant.value) return
  gamification.setRating(qb.currentVariant.value, nodeId, type, value)
}

const editingVariantId = ref(null)
const editingVariantLabel = ref('')

function startRenameVariant(id) {
  editingVariantId.value = id
  editingVariantLabel.value = qb.variants[id]?.label ?? ''
}

async function confirmRenameVariant(id) {
  const trimmed = editingVariantLabel.value?.trim()
  if (!trimmed) return
  const serverVariants = await autosave.fetchServerVariants()
  if (serverVariants.includes(trimmed) && trimmed !== id) {
    showToast('Name bereits auf dem Server vergeben')
    return
  }
  const newId = qb.renameVariant(id, trimmed)
  if (newId === false) { showToast('Name bereits vergeben'); return }
  if (typeof newId === 'string' && newId !== id) {
    gamification.renameVariantRatings(id, newId)
    autosave.renameLinked(id, newId)
  }
  editingVariantId.value = null
}

function cancelRenameVariant() {
  editingVariantId.value = null
}

async function handleAddVariant() {
  const name = prompt('Name der neuen Variante:')
  if (!name?.trim()) return
  const trimmed = name.trim()
  if (!qb.addVariant(trimmed)) { alert('Name bereits lokal vergeben.'); return }
  const serverVariants = await autosave.fetchServerVariants()
  if (serverVariants.includes(trimmed)) {
    const ok = confirm(`Der Name "${trimmed}" ist auf dem Server bereits vergeben. Trotzdem verwenden?\n(Achtung: beim Speichern wird die Server-Variante überschrieben.)`)
    if (!ok) { qb.deleteVariant(trimmed); return }
  }
  qb.switchVariant(trimmed)
  showToast('Variante "' + trimmed + '" erstellt')
}

function handleMerge({ fromId, toId, newName }) {
  const target = qb.mergeVariants(fromId, toId, newName)
  showMerge.value = false
  qb.switchVariant(target)
  showToast('Zusammengeführt → "' + target + '"')
}

function handleImport({ raw, asVariant }) {
  try {
    qb.importJSON(raw, asVariant)
    showImport.value = false
    selectedId.value = null
    showToast('Import erfolgreich')
  } catch (e) { alert('Ungültiges JSON: ' + e.message) }
}

// ── Server Storage ─────────────────────────────────────────────────────────

const uploadServer = import.meta.env.VITE_UPLOAD_SERVER ?? ''
const autosave = useAutosave(uploadServer)

const autosaveStatus = computed(() => autosave.getStatus(qb.currentVariant.value))
const autosaveButtonLabel = computed(() => {
  const s = autosaveStatus.value.status
  if (s === 'saving') return '⏳ Speichert…'
  if (s === 'saved') return '✓ Autosave'
  if (s === 'error') return '⚠ Fehler – erneut speichern'
  if (autosave.isLinked(qb.currentVariant.value)) return '↑ Jetzt speichern'
  return '↑ Auf Server speichern'
})
const autosaveButtonTooltip = computed(() => {
  const s = autosaveStatus.value
  if (s.status === 'saved') return `Zuletzt: ${s.message?.slice(0, 16)} · Klick für Sofort-Speichern`
  if (s.status === 'error') return `Fehler: ${s.message} · Klick zum Wiederholen`
  if (autosave.isLinked(qb.currentVariant.value))
    return 'Autosave aktiv – wird nach jeder Änderung automatisch gespeichert'
  return 'Variante auf Server speichern (dann automatisch nach jeder Änderung)'
})

// Debounced Autosave: nach jeder Änderung an einer verlinkten Variante
let autosaveTimer = null
watch(
  () => JSON.stringify(qb.variants[qb.currentVariant.value]) +
        JSON.stringify(gamification.ratings[qb.currentVariant.value]),
  () => {
    const variantId = qb.currentVariant.value
    if (!autosave.isLinked(variantId)) return
    clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(async () => {
      const id = qb.currentVariant.value
      const exportData = JSON.stringify({
        exportedAt: new Date().toISOString(),
        variants: { [id]: qb.variants[id] },
        ratings: gamification.ratings[id] ?? {}
      }, null, 2)
      try { await autosave.saveToServer(id, exportData) } catch (_) {}
    }, 3000)
  }
)

async function saveVariantToServer() {
  const variantId = qb.currentVariant.value
  const serverVariants = await autosave.fetchServerVariants()

  if (serverVariants.includes(variantId)) {
    const ok = confirm(`Variante "${variantId}" ist auf dem Server bereits vorhanden. Überschreiben?`)
    if (!ok) return
  }

  const singleExport = JSON.stringify({
    exportedAt: new Date().toISOString(),
    variants: { [variantId]: qb.variants[variantId] },
    ratings: gamification.ratings[variantId] ?? {}
  }, null, 2)

  try {
    await autosave.saveToServer(variantId, singleExport)
    showToast('Auf Server gespeichert ✓')
  } catch (err) {
    showToast('Fehler: ' + err.message)
  }
}

async function loadVariantFromServer() {
  const name = prompt('Name der Variante (ohne .json):')
  if (!name?.trim()) return
  const trimmed = name.trim()
  if (qb.variants[trimmed]) {
    showToast(`Variante "${trimmed}" existiert bereits lokal`)
    return
  }
  try {
    const res = await fetch(`${uploadServer}/php/get_variant.php?name=${encodeURIComponent(trimmed)}`)
    if (!res.ok) throw new Error(`Nicht gefunden (HTTP ${res.status})`)
    const raw = await res.text()
    const parsed = JSON.parse(raw)
    qb.importJSON(raw, trimmed)
    if (parsed.ratings && Object.keys(parsed.ratings).length > 0) {
      gamification.restoreVariantRatings(trimmed, parsed.ratings)
    }
    autosave.markLinked(trimmed)
    autosave.recordSave(trimmed, parsed.exportedAt ?? null)
    if (parsed.exportedAt) autosave.setStatus(trimmed, 'saved', parsed.exportedAt)
    selectedId.value = null
    showToast(`Variante "${trimmed}" geladen`)
  } catch (err) {
    showToast('Fehler: ' + err.message)
  }
}

async function loadOriginalFromServer() {
  try {
    const res = await fetch(`${uploadServer}/php/get_original.php`)
    if (!res.ok) throw new Error('Original nicht gefunden (HTTP ' + res.status + ')')
    const raw = await res.text()
    qb.importJSON(raw, 'original')
    // Ensure 'original' is always the first variant
    const allKeys = Object.keys(qb.variants)
    if (allKeys[0] !== 'original') {
      const reordered = { original: qb.variants['original'] }
      allKeys.filter(k => k !== 'original').forEach(k => { reordered[k] = qb.variants[k] })
      Object.keys(qb.variants).forEach(k => delete qb.variants[k])
      Object.assign(qb.variants, reordered)
    }
    selectedId.value = null
    showToast('Original geladen')
  } catch (err) {
    showToast('Fehler: ' + err.message)
  }
}

async function loadAllVariantsFromServer() {
  try {
    const serverVariants = await autosave.fetchServerVariants()
    let loaded = 0
    for (const name of serverVariants) {
      if (qb.variants[name]) continue // bereits lokal vorhanden
      const res = await fetch(`${uploadServer}/php/get_variant.php?name=${encodeURIComponent(name)}`)
      if (!res.ok) continue
      const raw = await res.text()
      const parsed = JSON.parse(raw)
      qb.importJSON(raw, name)
      if (parsed.ratings) gamification.restoreVariantRatings(name, parsed.ratings)
      autosave.markLinked(name)
      autosave.recordSave(name, parsed.exportedAt ?? null)
      if (parsed.exportedAt) autosave.setStatus(name, 'saved', parsed.exportedAt)
      loaded++
    }
    showToast(loaded > 0 ? `${loaded} Variante(n) vom Server geladen` : 'Alle Varianten bereits lokal vorhanden')
  } catch (err) {
    showToast('Fehler beim Laden: ' + err.message)
  }
}

// Analysis-only variants: loaded from server but NOT added to qb.variants
// so they don't appear in the editor's variant panel
const analysisOnlyVariants = ref({})

async function loadAllVariantsForAnalysis() {
  try {
    const serverVariants = await autosave.fetchServerVariants()
    const updates = {}
    for (const name of serverVariants) {
      if (qb.variants[name]) continue // own variant – already in qb.variants
      try {
        const res = await fetch(`${uploadServer}/php/get_variant.php?name=${encodeURIComponent(name)}`)
        if (!res.ok) continue
        const raw = await res.text()
        const parsed = JSON.parse(raw)
        const srcKey = Object.keys(parsed.variants ?? {})[0] ?? name
        const data = parsed.variants?.[srcKey]
        if (data) updates[name] = { id: name, label: data.label ?? name, nodes: data.nodes ?? [] }
      } catch (_) {}
    }
    analysisOnlyVariants.value = updates
  } catch (err) {
    showToast('Fehler beim Laden: ' + err.message)
  }
}

const analysisVariants = computed(() => ({ ...qb.variants, ...analysisOnlyVariants.value }))

function doExport() {
  const json = qb.exportJSON()
  const blob = new Blob([json], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'fragebogen_' + new Date().toISOString().slice(0, 10) + '.json'
  a.click()
  showToast('JSON exportiert')
}
</script>

<template>
  <div id="app">
    <!-- Header -->
    <header class="app-header">
      <h1>✦ Fragebogen-Editor</h1>
      <div class="btn-group" style="margin-left:12px">
        <button class="btn btn-sm" :disabled="isMainVariant" @click="handleAddRoot('section')">+ Abschnitt</button>
      </div>
      <div class="btn-group" style="margin-left:4px">
        <button data-tour="undo-btn" class="btn btn-sm" :disabled="!canUndo" @click="doUndo" title="Rückgängig (Strg+Z)">↩</button>
        <button class="btn btn-sm" :disabled="!canRedo" @click="doRedo" title="Wiederholen (Strg+Y)">↪</button>
      </div>
      <div class="header-sep"></div>
      <div class="btn-group header-actions-desktop">
        <button class="btn btn-sm" @click="showMerge = true">⇄ Zusammenführen</button>
        <button class="btn btn-sm" @click="showImport = true">↑ Import</button>
        <button class="btn btn-sm btn-primary" @click="doExport">↓ JSON Export</button>
      </div>
      <div class="header-sep header-actions-desktop"></div>
      <button
        class="btn btn-sm"
        @click="showOnboarding = true"
        title="Einführungs-Tour starten"
      >❓</button>
    </header>

    <!-- Tab bar (Editor/Vorschau/JSON) + Mobile Panel Tabs -->
    <div style="display:flex;border-bottom:1px solid var(--border);background:var(--bg);flex-shrink:0;justify-content:space-between">
      <div style="display:flex">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :data-tour="tab.id === 'preview' ? 'preview-tab' : undefined"
          class="btn btn-ghost btn-sm"
          :style="activeTab === tab.id
            ? 'border-bottom:2px solid var(--text);border-radius:0;color:var(--text);padding:8px 16px'
            : 'border-radius:0;color:var(--text3);padding:8px 16px'"
          @click="activeTab = tab.id; activePanel = 'content'"
        >{{ tab.label }}</button>
      </div>
      <!-- Mobile-only panel switcher -->
      <div class="mobile-panel-tabs">
        <button
          v-for="item in [{ id: 'structure', icon: '☰' }, { id: 'content', icon: '✎' }, { id: 'variants', icon: '◈' }]"
          :key="item.id"
          class="btn btn-ghost btn-sm"
          :style="activePanel === item.id
            ? 'border-bottom:2px solid var(--text);border-radius:0;color:var(--text);padding:8px 14px'
            : 'border-radius:0;color:var(--text3);padding:8px 14px'"
          @click="activePanel = item.id"
        >{{ item.icon }}</button>
      </div>
    </div>

    <!-- Analysis view (full-width, replaces workspace) -->
    <AnalysisView
      v-if="activeTab === 'analyse'"
      :variants="analysisVariants"
      :baseline-id="baselineVariantId"
      :load-all-from-server="loadAllVariantsForAnalysis"
      style="flex:1;overflow:hidden"
    />

    <!-- Main workspace -->
    <div v-else class="workspace" @touchstart.passive="onSwipeStart" @touchend.passive="onSwipeEnd">
      <!-- Left: Tree -->
      <div data-tour="structure-panel" class="panel" :class="{ 'panel--mobile-active': activePanel === 'structure' }">
        <div class="panel-header">
          <h2>Struktur</h2>
        </div>
        <div class="panel-body">
          <div v-if="!qb.nodes.value.length" style="padding:20px;text-align:center;color:var(--text3);font-size:13px">
            Noch keine Nodes.<br>Oben "+ Abschnitt" klicken.
          </div>
          <VueDraggable
            v-if="qb.variants[qb.currentVariant.value]"
            v-model="qb.variants[qb.currentVariant.value].nodes"
            handle=".drag-handle"
            :animation="150"
            :disabled="isMainVariant"
          >
            <TreeNode
              v-for="element in qb.variants[qb.currentVariant.value].nodes"
              :key="element.id"
              :node="element"
              :selected-id="selectedId"
              :rated-ids="ratedNodeIds"
              :show-ratings="!isMainVariant"
              :readonly="isMainVariant"
              @select="selectNode"
              @delete="handleDelete"
              @add-child="handleAddChild"
            />
          </VueDraggable>
        </div>
        <div class="panel-footer">
          <div class="stats-row">
            <div class="stat">
              <div class="stat-val">{{ stats.s }}</div>
              <div class="stat-label">Abschn.</div>
            </div>
            <div class="stat">
              <div class="stat-val">{{ stats.q }}</div>
              <div class="stat-label">Fragen</div>
            </div>
            <div class="stat">
              <div class="stat-val">{{ stats.sq }}</div>
              <div class="stat-label">Unterfr.</div>
            </div>
            <div class="stat">
              <div class="stat-val">{{ stats.icf }}</div>
              <div class="stat-label">ICF</div>
            </div>
          </div>
          <div v-if="ratingStats" class="stats-row" style="margin-top:6px;border-top:1px solid var(--border);padding-top:6px">
            <div class="stat">
              <div class="stat-val" style="color:var(--success,#16a34a)">{{ ratingStats.done }}</div>
              <div class="stat-label">bewertet</div>
            </div>
            <div class="stat">
              <div class="stat-val" style="color:var(--text3)">{{ ratingStats.todo }}</div>
              <div class="stat-label">ausstehend</div>
            </div>
            <div class="stat">
              <div class="stat-val">{{ ratingStats.total }}</div>
              <div class="stat-label">gesamt</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Center: Editor / Preview / JSON -->
      <div data-tour="content-panel" class="panel" :class="{ 'panel--mobile-active': activePanel === 'content' }">
        <div class="panel-body" style="padding:0">

          <template v-if="activeTab === 'editor'">
            <NodeEditor
              :node="selectedNode"
              :readonly="isMainVariant"
              @update="handleUpdate"
              @delete="handleDelete"
              @add-child="handleAddChild"
            />
          </template>

          <template v-else-if="activeTab === 'preview'">
            <div style="padding:16px">
              <div class="info-box" style="margin-bottom:16px">
                Vorschau aller Fragen in der aktuellen Variante (ohne Verzweigungslogik).
              </div>
              <PreviewPanel
                :nodes="qb.nodes.value"
                :selected-id="selectedId"
                :variant-id="qb.currentVariant.value"
                :is-main-variant="isMainVariant"
                :ratings="gamification.ratings"
                @rate="handleRate"
              />
            </div>
          </template>

          <template v-else-if="activeTab === 'json'">
            <div style="padding:16px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <span style="font-size:12px;color:var(--text2);font-weight:600">JSON EXPORT VORSCHAU</span>
                <button class="btn btn-sm btn-primary" @click="doExport">↓ Herunterladen</button>
              </div>
              <div
                v-if="jsonParseError"
                data-testid="json-error"
                style="margin-bottom:8px;padding:6px 10px;background:#fee2e2;color:#b91c1c;border-radius:var(--radius);font-size:12px;font-family:monospace"
              >{{ jsonParseError }}</div>
              <div class="json-editor-wrap">
                <!-- Farbiger Stripe für den selektierten Node -->
                <div
                  v-if="jsonStripeStyle"
                  class="json-node-stripe"
                  aria-hidden="true"
                  :style="jsonStripeStyle"
                ></div>
                <!-- Editierbare Textarea -->
                <textarea
                  ref="jsonTextareaRef"
                  data-testid="json-editor"
                  class="json-editor-textarea"
                  v-model="jsonEditContent"
                  @input="handleJsonInput"
                  @keydown="handleJsonKeyDown"
                  @scroll="syncJsonScroll"
                  spellcheck="false"
                ></textarea>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Right: Variant panel -->
      <div data-tour="variants-panel" class="panel" :class="{ 'panel--mobile-active': activePanel === 'variants' }">
        <div class="panel-header">
          <h2>Varianten</h2>
          <button data-tour="add-variant" class="btn btn-sm" @click="handleAddVariant">+ Neue</button>
        </div>
        <div class="panel-body">
          <div
            v-for="v in qb.variantList.value"
            :key="v.id"
            class="tree-item"
            :class="{ selected: v.id === qb.currentVariant.value }"
            data-testid="variant-item"
            @click="qb.switchVariant(v.id)"
            style="margin-bottom:3px"
          >
            <span class="ti-icon">◈</span>
            <template v-if="editingVariantId === v.id">
              <input
                data-testid="variant-name-input"
                :value="editingVariantLabel"
                @input="editingVariantLabel = $event.target.value"
                @keydown.enter.stop="confirmRenameVariant(v.id)"
                @keydown.escape.stop="cancelRenameVariant()"
                @click.stop
                style="font-size:12px;padding:1px 4px;width:100px"
              />
            </template>
            <template v-else>
              <span class="ti-label">{{ v.label }}</span>
              <span v-if="v.id !== baselineVariantId" data-testid="variant-points" data-tour="variant-points" class="variant-points-badge">
                {{ variantPoints[v.id] ?? 0 }} Pkt
              </span>
              <span v-if="autosave.isLinked(v.id)"
                :title="autosave.getStatus(v.id).message || 'Autosave aktiv'"
                style="font-size:10px;margin-left:2px">
                {{ { idle: '○', saving: '⏳', saved: '✓', error: '⚠' }[autosave.getStatus(v.id).status] }}
              </span>
              <span style="font-size:10px;color:var(--text3)">{{ v.nodes?.length ?? 0 }} root</span>
              <button
                v-if="v.id !== baselineVariantId"
                class="btn btn-sm"
                data-testid="rename-variant"
                style="padding:1px 6px;font-size:11px"
                @click.stop="startRenameVariant(v.id)"
                title="Variante umbenennen"
              >✎</button>
            </template>
            <button
              v-if="qb.variantList.value.length > 1"
              class="btn btn-sm"
              data-testid="delete-variant"
              style="margin-left:auto;padding:1px 6px;font-size:11px;color:var(--danger,#b91c1c)"
              @click.stop="handleDeleteVariant(v.id)"
              title="Variante löschen"
            >✕</button>
          </div>
          <!-- Server-Aktionen -->
          <div style="margin-top:12px;display:flex;flex-direction:column;gap:6px">
            <button data-tour="autosave-btn" class="btn btn-sm btn-primary"
              :title="autosaveButtonTooltip"
              @click="saveVariantToServer">
              {{ autosaveButtonLabel }}
            </button>
            <button class="btn btn-sm" @click="loadVariantFromServer">↓ Variante laden</button>
            <button class="btn btn-sm" @click="loadOriginalFromServer">↓ Original laden</button>
          </div>
        </div>
        <div class="panel-footer">
          <div style="font-size:11px;color:var(--text3);line-height:1.6">
            <strong style="color:var(--text2)">Workflow:</strong><br>
            1. Neue Variante anlegen und mit einem einmaligen Namen versehen<br>
            2. Variante bearbeiten<br>
            3. Variante Auf Server speichern, danach Autosave aktiviert<br>
            © <a href="mailto:post@renecol.org" style="margin-left:8px;vertical-align:middle; opacity: 0.5;">Peter Bernstein, 2026</a>
            <a href="https://www.linkedin.com/in/peter-bernstein-renecol" target="_blank" rel="noopener noreferrer" style="margin-left:8px;vertical-align:middle; opacity: 0.5;" aria-label="LinkedIn">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-9h3v9zm-1.5-10.271c-.966 0-1.75-.79-1.75-1.764 0-.974.784-1.765 1.75-1.765s1.75.791 1.75 1.765c0 .974-.784 1.764-1.75 1.764zm13.5 10.271h-3v-4.5c0-1.072-.02-2.45-1.494-2.45-1.496 0-1.727 1.17-1.727 2.377v4.573h-3v-9h2.879v1.233h.041c.401-.759 1.379-1.56 2.838-1.56 3.036 0 3.6 1.998 3.6 4.593v5.734z"/>
              </svg>
            </a>
              <a href="https://github.com/bernspe/qbuilder3" target="_blank" rel="noopener noreferrer" style="margin-left:8px;vertical-align:middle; opacity: 0.5;" aria-label="GitHub" title="GitHub">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle">
                <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.38 7.86 10.9.57.1.78-.25.78-.55 0-.27-.01-1-.02-1.96-3.2.7-3.88-1.38-3.88-1.38-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.73-1.52-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.47.11-3.06 0 0 .96-.31 3.14 1.18.91-.25 1.9-.38 2.88-.38s1.97.13 2.88.38c2.18-1.49 3.14-1.18 3.14-1.18.62 1.59.23 2.77.11 3.06.73.81 1.18 1.84 1.18 3.1 0 4.43-2.71 5.4-5.29 5.68.41.36.77 1.08.77 2.18 0 1.57-.01 2.84-.01 3.23 0 .3.21.66.79.55C20.71 21.38 24 17.08 24 12c0-6.27-5.73-11.5-12-11.5z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Status bar -->
    <div class="statusbar">
      <span>Variante: <strong>{{ qb.variants[qb.currentVariant.value]?.label }}</strong> · {{ qb.variantList.value.length }} Variante(n) insgesamt</span>
      <span>
        {{ autosaveStatus.status === 'saved' ? '✓ Server-Sync' :
           autosaveStatus.status === 'saving' ? '⏳ Speichert…' :
           autosaveStatus.status === 'error' ? '⚠ Sync-Fehler' :
           autosave.isLinked(qb.currentVariant.value) ? '○ Autosave aktiv' : 'Autosave (lokal)' }}
        · Undo/Redo: Strg+Z / Strg+Y
      </span>
    </div>

    <!-- Modals -->
    <MergeModal
      v-if="showMerge"
      :variants="qb.variants"
      @close="showMerge = false"
      @merge="handleMerge"
    />
    <ImportModal
      v-if="showImport"
      @close="showImport = false"
      @import="handleImport"
    />

    <!-- Onboarding -->
    <OnboardingModal
      v-if="showOnboarding"
      :variant-count="qb.variantList.value.length"
      :selected-id="selectedId"
      :selected-node-type="selectedNodeType"
      :active-tab="activeTab"
      :current-variant-linked="autosave.isLinked(qb.currentVariant.value)"
      :rating-count="ratingCount"
      @close="closeOnboarding"
      @activate="({ panel, tab }) => { if (panel) activePanel = panel; if (tab) activeTab = tab }"
    />

    <!-- Toasts -->
    <div v-for="t in toasts" :key="t.id" class="toast">{{ t.msg }}</div>
  </div>
</template>
