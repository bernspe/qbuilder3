<script setup>
import { computed, ref } from 'vue'
import IconDisplay from './IconDisplay.vue'
import GradientAnswerButtons from './GradientAnswerButtons.vue'
import { lookupIcf, getIcfAnswers } from '../composables/useIcfData.js'

const props = defineProps({
  node: Object,
  readonly: { type: Boolean, default: false }
})
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

// ICF: auto-populate on blur/Enter
function applyIcfCode(code) {
  const trimmed = code.trim().toLowerCase()
  update('icfCode', trimmed)
  const data = lookupIcf(trimmed)
  if (data) {
    update('label', data.name)
    update('subheading', data.description)
    update('icon', `icf:${trimmed}`)
    update('options', getIcfAnswers(trimmed))
    update('question', '')
  }
}

const icfLookup = computed(() => props.node?.type === 'icf' ? lookupIcf(props.node.icfCode) : null)
const icfAnswers = computed(() => getIcfAnswers(props.node?.icfCode))
const icfColorScheme = computed(() => props.node?.icfCode?.toLowerCase().startsWith('e') ? 'environment' : 'restriction')

const iconFileInput = ref(null)
const iconUploading = ref(false)
const iconUploadError = ref('')

const uploadServer = import.meta.env.VITE_UPLOAD_SERVER ?? ''

async function handleIconFileSelected(event) {
  const file = event.target.files[0]
  if (!file) return
  iconUploadError.value = ''
  event.target.value = ''
  if (file.size > 500 * 1024) {
    iconUploadError.value = 'Datei zu groß (max. 500 kB)'
    return
  }
  iconUploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${uploadServer}/php/upload.php`, { method: 'POST', body: formData })
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(data.error || 'Upload fehlgeschlagen')
    update('icon', `${uploadServer}${data.url}`)
  } catch (err) {
    iconUploadError.value = err.message
  } finally {
    iconUploading.value = false
  }
}

const questionPreviewOptions = computed(() => {
  if (!props.node) return []
  if (props.node.questionType === 'yesno') return ['Ja', 'Nein']
  if (props.node.questionType === 'scale') return ['1', '2', '3', '4', '5']
  return []
})
</script>

<template>
  <div v-if="node" style="padding:16px;overflow-y:auto;height:100%">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
      <span class="type-indicator" :class="'type-' + node.type">
        {{ typeIcon }} {{ typeLabel }}
      </span>
      <span v-if="readonly" class="readonly-badge">Nur lesen</span>
      <button v-else class="btn btn-danger btn-sm" @click="emit('delete', node.id)">Löschen</button>
    </div>

    <div class="card" :class="{ 'card--readonly': readonly }">

      <!-- ══ ICF-ITEM ══ -->
      <template v-if="node.type === 'icf'">
        <div class="field">
          <label>ICF-Code</label>
          <input
            type="text"
            :value="node.icfCode ?? ''"
            @change="applyIcfCode($event.target.value)"
            placeholder="z.B. d415"
          />
          <div class="icf-links" style="margin-top:6px">
            <a href="https://icfmapper.renecol.org" target="_blank" class="btn btn-ghost btn-sm">ICF Mapper ↗</a>
            <a href="https://apps.who.int/classifications/icfbrowser/" target="_blank" class="btn btn-ghost btn-sm">WHO ICF Browser ↗</a>
          </div>
        </div>

        <div v-if="node.icon" class="field">
          <label>Icon (auto)</label>
          <IconDisplay :icon="node.icon" :size="56" />
        </div>

        <div class="field">
          <label>Heading (auto aus Mappingtabelle)</label>
          <input type="text" :value="node.label" @input="update('label', $event.target.value)" />
        </div>

        <div class="field">
          <label>Subheading / Beschreibung (auto)</label>
          <textarea :value="node.subheading ?? ''" @input="update('subheading', $event.target.value)" rows="2"></textarea>
        </div>

        <div class="field">
          <label>Fragetext</label>
          <textarea
            :value="node.question ?? ''"
            @input="update('question', $event.target.value)"
            rows="2"
            placeholder="z.B. Wie stark haben Sie Schwierigkeiten mit ...?"
          ></textarea>
        </div>

        <div v-if="icfLookup?.fragen?.length" class="field">
          <label>Beispielfragen (klicken zum Übernehmen)</label>
          <ul class="icf-suggestions">
            <li v-for="(frage, i) in icfLookup.fragen" :key="i" @click="update('question', frage)">
              {{ frage }}
            </li>
          </ul>
        </div>

        <div class="field">
          <label>Antwortset ({{ node.icfCode?.toLowerCase().startsWith('e') ? 'Kapitel e' : 'Kapitel b/d/s' }})</label>
          <GradientAnswerButtons
            :options="icfAnswers"
            :defaultIdx="node.defaultIdx"
            :colorScheme="icfColorScheme"
            :order="node.icfCode?.toLowerCase().startsWith('e') ? 'schlecht-gut' : 'gut-schlecht'"
          />
        </div>

        <div class="field" v-if="icfAnswers.length">
          <label>Vorausgewählte Antwort</label>
          <select
            :value="node.defaultIdx ?? ''"
            @change="update('defaultIdx', $event.target.value === '' ? null : Number($event.target.value))"
          >
            <option value="">Keine Vorbelegung</option>
            <option v-for="(ans, i) in icfAnswers" :key="i" :value="i">{{ i + 1 }}. {{ ans }}</option>
          </select>
        </div>

        <div class="field">
          <label>Referenz</label>
          <input type="text" :value="node.reference ?? ''" @input="update('reference', $event.target.value)" placeholder="z.B. WHODAS Frage 1.1" />
        </div>

        <div class="field">
          <label>Hilfetext</label>
          <textarea :value="node.helpText ?? ''" @input="update('helpText', $event.target.value)" rows="2"></textarea>
        </div>
      </template>

      <!-- ══ SCREENINGFRAGE ══ -->
      <template v-else-if="node.type === 'question'">
        <div class="field">
          <label>Icon</label>
          <div style="display:flex;align-items:center;gap:10px">
            <input
              type="text"
              :value="node.icon ?? ''"
              @input="update('icon', $event.target.value)"
              placeholder="z.B. twemoji:man-standing"
              style="flex:1"
            />
            <IconDisplay v-if="node.icon" :icon="node.icon" :size="36" />
            <button
              class="btn btn-sm"
              :disabled="iconUploading || readonly"
              @click="iconFileInput.click()"
              title="Bild hochladen (max. 500 kB)"
              style="white-space:nowrap"
            >{{ iconUploading ? '…' : '↑ Upload' }}</button>
            <input ref="iconFileInput" type="file" accept="image/*" style="display:none" @change="handleIconFileSelected" />
          </div>
          <a href="https://icon-sets.iconify.design/" target="_blank" class="icon-search-link">Icons suchen auf icon-sets.iconify.design ↗</a>
          <div v-if="iconUploadError" style="color:var(--danger,#b91c1c);font-size:11px;margin-top:4px">{{ iconUploadError }}</div>
        </div>

        <div class="field">
          <label>Heading / Bezeichnung</label>
          <input type="text" :value="node.label" @input="update('label', $event.target.value)" />
        </div>

        <div class="field">
          <label>Subheading</label>
          <input type="text" value="Screeningfrage" readonly style="opacity:0.45;cursor:default" />
        </div>

        <div class="field">
          <label>Fragetext</label>
          <textarea
            :value="node.question ?? ''"
            @input="update('question', $event.target.value)"
            rows="2"
            placeholder="z.B. Haben Sie Schwierigkeiten mit ...?"
          ></textarea>
        </div>

        <div class="field">
          <label>Referenz</label>
          <input type="text" :value="node.reference ?? ''" @input="update('reference', $event.target.value)" placeholder="z.B. SF36 Frage 1" />
        </div>

        <div class="field">
          <label>Fragetyp</label>
          <select :value="node.questionType" @change="update('questionType', $event.target.value)">
            <option value="yesno">Ja / Nein</option>
            <option value="scale">Skala (1–5)</option>
          </select>
        </div>

        <div v-if="node.questionType === 'scale'" class="field">
          <label>Skala-Beschriftung</label>
          <div class="row">
            <input type="text" class="col" :value="node.scaleMin ?? ''" @input="update('scaleMin', $event.target.value)" placeholder="Min-Label" />
            <input type="text" class="col" :value="node.scaleMax ?? ''" @input="update('scaleMax', $event.target.value)" placeholder="Max-Label" />
          </div>
        </div>

        <div class="field" v-if="questionPreviewOptions.length">
          <label>Antwortreihenfolge (Farbgradient)</label>
          <div class="btn-group">
            <button
              class="btn btn-sm"
              :class="{ 'btn-primary': (node.answerOrder ?? 'schlecht-gut') === 'schlecht-gut' }"
              @click="update('answerOrder', 'schlecht-gut')"
            >schlecht → gut</button>
            <button
              class="btn btn-sm"
              :class="{ 'btn-primary': node.answerOrder === 'gut-schlecht' }"
              @click="update('answerOrder', 'gut-schlecht')"
            >gut → schlecht</button>
          </div>
        </div>

        <div class="field" v-if="questionPreviewOptions.length">
          <label>Vorschau Antworten</label>
          <GradientAnswerButtons
            :options="questionPreviewOptions"
            :defaultIdx="node.defaultIdx"
            colorScheme="restriction"
            :order="node.answerOrder ?? 'schlecht-gut'"
          />
        </div>

        <div class="field">
          <label>Hilfetext</label>
          <textarea :value="node.helpText ?? ''" @input="update('helpText', $event.target.value)" rows="2"></textarea>
        </div>

        <div class="field" style="padding-top:2px">
          <label class="checkbox-row">
            <input type="checkbox" :checked="node.required" @change="update('required', $event.target.checked)" />
            Pflichtfeld
          </label>
        </div>
      </template>

      <!-- ══ UNTERFRAGE ══ -->
      <template v-else-if="node.type === 'subquestion'">
        <div class="field">
          <label>Icon</label>
          <div style="display:flex;align-items:center;gap:10px">
            <input
              type="text"
              :value="node.icon ?? ''"
              @input="update('icon', $event.target.value)"
              placeholder="z.B. twemoji:man-standing"
              style="flex:1"
            />
            <IconDisplay v-if="node.icon" :icon="node.icon" :size="36" />
            <button
              class="btn btn-sm"
              :disabled="iconUploading || readonly"
              @click="iconFileInput.click()"
              title="Bild hochladen (max. 500 kB)"
              style="white-space:nowrap"
            >{{ iconUploading ? '…' : '↑ Upload' }}</button>
            <input ref="iconFileInput" type="file" accept="image/*" style="display:none" @change="handleIconFileSelected" />
          </div>
          <a href="https://icon-sets.iconify.design/" target="_blank" class="icon-search-link">Icons suchen auf icon-sets.iconify.design ↗</a>
          <div v-if="iconUploadError" style="color:var(--danger,#b91c1c);font-size:11px;margin-top:4px">{{ iconUploadError }}</div>
        </div>

        <div class="field">
          <label>Heading / Bezeichnung</label>
          <input type="text" :value="node.label" @input="update('label', $event.target.value)" />
        </div>

        <div class="field">
          <label>Subheading (übergeordnete Screeningfrage)</label>
          <input type="text" :value="node.subheading ?? ''" @input="update('subheading', $event.target.value)" />
        </div>

        <div class="field">
          <label>Fragetext</label>
          <textarea
            :value="node.question ?? ''"
            @input="update('question', $event.target.value)"
            rows="2"
            placeholder="z.B. Wie stark haben Sie Schwierigkeiten mit ...?"
          ></textarea>
        </div>

        <div class="field">
          <label>Referenz</label>
          <input type="text" :value="node.reference ?? ''" @input="update('reference', $event.target.value)" placeholder="z.B. SF36 Frage 2" />
        </div>

        <div class="field">
          <label>Antwortoptionen (eine pro Zeile)</label>
          <textarea
            class="option-list-input"
            :value="(node.options ?? []).join('\n')"
            @input="update('options', $event.target.value.split('\n').map(s => s.trim()).filter(Boolean))"
            rows="5"
            placeholder="Option A&#10;Option B&#10;Option C"
          ></textarea>
        </div>

        <template v-if="(node.options ?? []).length">
          <div class="field">
            <label>Antwortreihenfolge (Farbgradient)</label>
            <div class="btn-group">
              <button
                class="btn btn-sm"
                :class="{ 'btn-primary': (node.answerOrder ?? 'schlecht-gut') === 'schlecht-gut' }"
                @click="update('answerOrder', 'schlecht-gut')"
              >schlecht → gut</button>
              <button
                class="btn btn-sm"
                :class="{ 'btn-primary': node.answerOrder === 'gut-schlecht' }"
                @click="update('answerOrder', 'gut-schlecht')"
              >gut → schlecht</button>
            </div>
          </div>

          <div class="field">
            <label>Vorausgewählte Antwort</label>
            <select
              :value="node.defaultIdx ?? ''"
              @change="update('defaultIdx', $event.target.value === '' ? null : Number($event.target.value))"
            >
              <option value="">Keine Vorbelegung</option>
              <option v-for="(opt, i) in (node.options ?? [])" :key="i" :value="i">{{ i + 1 }}. {{ opt }}</option>
            </select>
          </div>

          <div class="field">
            <label>Vorschau Antworten</label>
            <GradientAnswerButtons
              :options="node.options ?? []"
              :defaultIdx="node.defaultIdx"
              colorScheme="restriction"
              :order="node.answerOrder ?? 'schlecht-gut'"
            />
          </div>
        </template>

        <div class="field">
          <label>Hilfetext</label>
          <textarea :value="node.helpText ?? ''" @input="update('helpText', $event.target.value)" rows="2"></textarea>
        </div>

        <div class="field" style="padding-top:2px">
          <label class="checkbox-row">
            <input type="checkbox" :checked="node.required" @change="update('required', $event.target.checked)" />
            Pflichtfeld
          </label>
        </div>
      </template>

      <!-- ══ VERZWEIGUNG ══ -->
      <template v-else-if="node.type === 'branch'">
        <div class="field">
          <label>Bezeichnung</label>
          <input type="text" :value="node.label" @input="update('label', $event.target.value)" />
        </div>
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

      <!-- ══ ABSCHNITT ══ -->
      <template v-else-if="node.type === 'section'">
        <div class="field">
          <label>Bezeichnung</label>
          <input type="text" :value="node.label" @input="update('label', $event.target.value)" />
        </div>
        <div class="info-box">
          Ein Abschnitt gruppiert Fragen und Unterbereiche. Wähle diesen Abschnitt im Baum aus und nutze die Schaltflächen unten, um Inhalte hinzuzufügen.
        </div>
      </template>

    </div><!-- end card -->

    <!-- Add-Child Buttons -->
    <template v-if="!readonly">
      <div v-if="node.type === 'question'" class="btn-group" style="margin-top:4px">
        <button class="btn" @click="emit('add-child', { type: 'subquestion', parentId: node.id })">+ Unterfrage</button>
        <button class="btn" @click="emit('add-child', { type: 'icf', parentId: node.id })">+ ICF-Item</button>
      </div>

      <div v-else-if="['section', 'branch'].includes(node.type)" class="btn-group" style="margin-top:4px">
        <button class="btn" @click="emit('add-child', { type: 'question', parentId: node.id })">+ Screeningfrage</button>
        <button class="btn" @click="emit('add-child', { type: 'branch', parentId: node.id })">+ Verzweigung</button>
        <button v-if="node.type === 'section'" class="btn" @click="emit('add-child', { type: 'section', parentId: null })">+ Abschnitt</button>
      </div>
    </template>
  </div>

  <div v-else class="editor-empty">
    <div class="empty-icon">✦</div>
    <p>Node im Baum auswählen</p>
    <p style="font-size:12px">oder neuen Abschnitt erstellen</p>
  </div>
</template>
