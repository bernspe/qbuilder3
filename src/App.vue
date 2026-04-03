<script setup>
import { ref, computed } from 'vue'
import { useQuestionnaire } from './composables/useQuestionnaire.js'
import { useToast } from './composables/useToast.js'
import { VueDraggable } from 'vue-draggable-plus'
import TreeNode from './components/TreeNode.vue'
import NodeEditor from './components/NodeEditor.vue'
import PreviewPanel from './components/PreviewPanel.vue'
import MergeModal from './components/MergeModal.vue'
import ImportModal from './components/ImportModal.vue'

const qb = useQuestionnaire()
const { toasts, show: showToast } = useToast()

const selectedId = ref(null)
const showMerge = ref(false)
const showImport = ref(false)
const activeTab = ref('editor') // 'editor' | 'preview' | 'json'

qb.loadFromStorage()

const selectedNode = computed(() => {
  if (!selectedId.value) return null
  return qb.findInVariant(selectedId.value)
})

const stats = computed(() => qb.countAll())
const jsonPreview = computed(() => qb.exportJSON())

const tabs = [
  { id: 'editor', label: 'Editor' },
  { id: 'preview', label: 'Vorschau' },
  { id: 'json', label: 'JSON' }
]

function selectNode(id) {
  selectedId.value = id
  activeTab.value = 'editor'
}

function handleDelete(id) {
  if (!confirm('Node und alle Unterelemente löschen?')) return
  qb.deleteNode(id)
  if (selectedId.value === id) selectedId.value = null
}

function handleUpdate({ id, field, value }) {
  const node = qb.findInVariant(id)
  if (node) node[field] = value
}

function handleAddChild({ type, parentId }) {
  const node = qb.addNode(type, parentId)
  selectedId.value = node.id
}

function handleAddRoot(type) {
  const node = qb.addNode(type, null)
  selectedId.value = node.id
}

function handleAddVariant() {
  const name = prompt('Name der neuen Variante:')
  if (!name) return
  if (!qb.addVariant(name)) { alert('Name bereits vergeben.'); return }
  qb.switchVariant(name)
  showToast('Variante "' + name + '" erstellt')
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
        <button class="btn btn-sm" @click="handleAddRoot('section')">+ Abschnitt</button>
        <button class="btn btn-sm" @click="handleAddRoot('question')">+ Screeningfrage</button>
        <button class="btn btn-sm" @click="handleAddRoot('branch')">+ Verzweigung</button>
      </div>
      <div class="header-sep"></div>
      <div class="btn-group">
        <button class="btn btn-sm" @click="showMerge = true">⇄ Zusammenführen</button>
        <button class="btn btn-sm" @click="showImport = true">↑ Import</button>
        <button class="btn btn-sm btn-primary" @click="doExport">↓ JSON Export</button>
      </div>
    </header>

    <!-- Tab bar -->
    <div style="display:flex;gap:0;border-bottom:1px solid var(--border);background:var(--bg);flex-shrink:0">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="btn btn-ghost btn-sm"
        :style="activeTab === tab.id
          ? 'border-bottom:2px solid var(--text);border-radius:0;color:var(--text);padding:8px 16px'
          : 'border-radius:0;color:var(--text3);padding:8px 16px'"
        @click="activeTab = tab.id"
      >{{ tab.label }}</button>
    </div>

    <!-- Main workspace -->
    <div class="workspace">
      <!-- Left: Tree -->
      <div class="panel">
        <div class="panel-header">
          <h2>Struktur</h2>
        </div>
        <div class="panel-body">
          <div v-if="!qb.nodes.value.length" style="padding:20px;text-align:center;color:var(--text3);font-size:13px">
            Noch keine Nodes.<br>Oben "+ Abschnitt" klicken.
          </div>
          <VueDraggable
            v-model="qb.variants[qb.currentVariant.value].nodes"
            handle=".drag-handle"
            :animation="150"
          >
            <TreeNode
              v-for="element in qb.variants[qb.currentVariant.value].nodes"
              :key="element.id"
              :node="element"
              :selected-id="selectedId"
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
              <div class="stat-label">Abschnitte</div>
            </div>
            <div class="stat">
              <div class="stat-val">{{ stats.q }}</div>
              <div class="stat-label">Fragen</div>
            </div>
            <div class="stat">
              <div class="stat-val">{{ stats.b }}</div>
              <div class="stat-label">Verzweigungen</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Center: Editor / Preview / JSON -->
      <div class="panel">
        <div class="panel-body" style="padding:0">

          <!-- Editor tab -->
          <template v-if="activeTab === 'editor'">
            <NodeEditor
              :node="selectedNode"
              @update="handleUpdate"
              @delete="handleDelete"
              @add-child="handleAddChild"
            />
          </template>

          <!-- Preview tab -->
          <template v-else-if="activeTab === 'preview'">
            <div style="padding:16px">
              <div class="info-box" style="margin-bottom:16px">
                Vorschau aller Fragen in der aktuellen Variante (ohne Verzweigungslogik).
              </div>
              <PreviewPanel :nodes="qb.nodes.value" />
            </div>
          </template>

          <!-- JSON tab -->
          <template v-else-if="activeTab === 'json'">
            <div style="padding:16px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <span style="font-size:12px;color:var(--text2);font-weight:600">JSON EXPORT VORSCHAU</span>
                <button class="btn btn-sm btn-primary" @click="doExport">↓ Herunterladen</button>
              </div>
              <textarea
                readonly
                :value="jsonPreview"
                style="font-family:monospace;font-size:11px;height:calc(100vh - 220px);width:100%;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:12px;resize:none;"
              ></textarea>
            </div>
          </template>
        </div>
      </div>

      <!-- Right: Variant panel -->
      <div class="panel">
        <div class="panel-header">
          <h2>Varianten</h2>
          <button class="btn btn-sm" @click="handleAddVariant">+ Neue</button>
        </div>
        <div class="panel-body">
          <div
            v-for="v in qb.variantList.value"
            :key="v.id"
            class="tree-item"
            :class="{ selected: v.id === qb.currentVariant.value }"
            @click="qb.switchVariant(v.id)"
            style="margin-bottom:3px"
          >
            <span class="ti-icon">◈</span>
            <span class="ti-label">{{ v.label }}</span>
            <span style="font-size:10px;color:var(--text3)">{{ v.nodes?.length ?? 0 }} root</span>
          </div>
        </div>
        <div class="panel-footer">
          <div style="font-size:11px;color:var(--text3);line-height:1.6">
            <strong style="color:var(--text2)">Workflow:</strong><br>
            1. Basis exportieren<br>
            2. Kolleg:in importiert als neue Variante<br>
            3. Überarbeitete Version exportieren<br>
            4. Mit "⇄ Zusammenführen" zusammenführen
          </div>
        </div>
      </div>
    </div>

    <!-- Status bar -->
    <div class="statusbar">
      <span>Variante: <strong>{{ qb.currentVariant.value }}</strong> · {{ qb.variantList.value.length }} Variante(n) insgesamt</span>
      <span>Autosave aktiv · Vue 3 Composition API</span>
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

    <!-- Toasts -->
    <div v-for="t in toasts" :key="t.id" class="toast">{{ t.msg }}</div>
  </div>
</template>
