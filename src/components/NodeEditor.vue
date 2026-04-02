<script setup>
import { computed } from 'vue'

const props = defineProps({ node: Object })
const emit = defineEmits(['update', 'delete', 'add-child'])

const typeIcon = computed(() => ({ section: '▸', question: '◉', subquestion: '○', icf: '⊞', branch: '⋱' }[props.node?.type] ?? ''))
const typeLabel = computed(() => ({ section: 'Abschnitt', question: 'Screeningfrage', subquestion: 'Unterfrage', icf: 'ICF-Item', branch: 'Verzweigung' }[props.node?.type] ?? ''))

function update(field, value) {
  emit('update', { id: props.node.id, field, value })
}

function updateBranch(i, label) {
  const branches = props.node.branches.map((b, idx) => idx === i ? { ...b, label } : b)
  update('branches', branches)
}

function addBranchPath() {
  const branches = [...(props.node.branches ?? []), { label: 'Neuer Pfad', children: [] }]
  update('branches', branches)
}

function removeBranchPath(i) {
  const branches = props.node.branches.filter((_, idx) => idx !== i)
  update('branches', branches)
}
</script>

<template>
  <div v-if="node" style="padding:16px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
      <span class="type-indicator" :class="'type-' + node.type">
        {{ typeIcon }} {{ typeLabel }}
      </span>
      <button class="btn btn-danger btn-sm" @click="emit('delete', node.id)">Löschen</button>
    </div>

    <div class="card">
      <div class="field">
        <label>Bezeichnung</label>
        <input type="text" :value="node.label" @input="update('label', $event.target.value)" />
      </div>

      <!-- QUESTION / SUBQUESTION / ICF fields -->
      <template v-if="['question', 'subquestion', 'icf'].includes(node.type)">
        <div class="field" v-if="node.type === 'icf'">
          <label>ICF-Code</label>
          <input type="text" :value="node.icfCode ?? ''" @input="update('icfCode', $event.target.value)" placeholder="z.B. b1301" />
        </div>
        <div class="row">
          <div class="field col">
            <label>Fragetyp</label>
            <select :value="node.questionType" @change="update('questionType', $event.target.value)">
              <option value="single">Einfachauswahl</option>
              <option value="multiple">Mehrfachauswahl</option>
              <option value="text">Freitext</option>
              <option value="scale">Skala (1–5)</option>
              <option value="yesno">Ja / Nein</option>
              <option value="date">Datum</option>
              <option value="number">Zahl</option>
            </select>
          </div>
          <div class="field" style="flex:0 0 auto;padding-top:22px">
            <label class="checkbox-row">
              <input type="checkbox" :checked="node.required" @change="update('required', $event.target.checked)" />
              Pflichtfeld
            </label>
          </div>
        </div>

        <div class="field">
          <label>Hilfetext / Beschreibung</label>
          <textarea :value="node.helpText ?? ''" @input="update('helpText', $event.target.value)" rows="2"></textarea>
        </div>

        <div class="field" v-if="['single', 'multiple'].includes(node.questionType)">
          <label>Antwortoptionen (eine pro Zeile)</label>
          <textarea
            class="option-list-input"
            :value="(node.options ?? []).join('\n')"
            @input="update('options', $event.target.value.split('\n').map(s => s.trim()).filter(Boolean))"
            rows="5"
            placeholder="Option A&#10;Option B&#10;Option C"
          ></textarea>
        </div>

        <div class="field" v-if="node.questionType === 'scale'">
          <label>Skala-Beschriftung</label>
          <div class="row">
            <input type="text" class="col" :value="node.scaleMin ?? '1 – stimme gar nicht zu'" @input="update('scaleMin', $event.target.value)" placeholder="Min-Label" />
            <input type="text" class="col" :value="node.scaleMax ?? '5 – stimme voll zu'" @input="update('scaleMax', $event.target.value)" placeholder="Max-Label" />
          </div>
        </div>
      </template><!-- end question/subquestion/icf -->

      <!-- BRANCH fields -->
      <template v-if="node.type === 'branch'">
        <div class="field">
          <label>Bedingung / Logik-Beschreibung</label>
          <input type="text" :value="node.condition ?? ''" @input="update('condition', $event.target.value)" placeholder="z.B. Antwort auf Frage X = Ja" />
        </div>
        <div class="field">
          <label>Verzweigungspfade</label>
          <div class="branch-path-card" v-for="(b, i) in node.branches" :key="i">
            <span class="path-num">{{ i + 1 }}.</span>
            <input type="text" :value="b.label" @input="updateBranch(i, $event.target.value)" style="flex:1" />
            <span class="path-info">{{ b.children?.length ?? 0 }} Nodes</span>
            <button class="btn btn-ghost btn-sm btn-icon" @click="removeBranchPath(i)" title="Pfad entfernen" style="color:var(--text3)">✕</button>
          </div>
          <button class="btn btn-ghost btn-sm" style="margin-top:6px" @click="addBranchPath">+ Pfad</button>
        </div>
      </template>

      <!-- SECTION note -->
      <template v-if="node.type === 'section'">
        <div class="info-box">
          Ein Abschnitt gruppiert Fragen und Unterbereiche. Wähle diesen Abschnitt im Baum aus und nutze die Schaltflächen unten, um Inhalte hinzuzufügen.
        </div>
      </template>
    </div>

    <!-- Buttons für Screeningfragen-Children -->
    <div v-if="node.type === 'question'" class="btn-group" style="margin-top:4px">
      <button class="btn" @click="emit('add-child', { type: 'subquestion', parentId: node.id })">+ Unterfrage</button>
      <button class="btn" @click="emit('add-child', { type: 'icf', parentId: node.id })">+ ICF-Item</button>
    </div>

    <!-- Buttons für Abschnitt / Verzweigung / root -->
    <div v-else-if="['section', 'branch'].includes(node.type)" class="btn-group" style="margin-top:4px">
      <button class="btn" @click="emit('add-child', { type: 'question', parentId: node.id })">+ Screeningfrage</button>
      <button class="btn" @click="emit('add-child', { type: 'branch', parentId: node.id })">+ Verzweigung</button>
      <button v-if="node.type === 'section'" class="btn" @click="emit('add-child', { type: 'section', parentId: null })">+ Abschnitt</button>
    </div>
  </div>

  <div v-else class="editor-empty">
    <div class="empty-icon">✦</div>
    <p>Node im Baum auswählen</p>
    <p style="font-size:12px">oder neuen Abschnitt erstellen</p>
  </div>
</template>
