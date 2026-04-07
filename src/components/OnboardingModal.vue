<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  variantCount:         { type: Number,  default: 1 },
  selectedId:           { type: String,  default: null },
  activeTab:            { type: String,  default: 'editor' },
  currentVariantLinked: { type: Boolean, default: false },
  ratingCount:          { type: Number,  default: 0 },
  // initialStep: allows tests to jump directly to a specific step
  initialStep:          { type: Number,  default: 0 },
})

const emit = defineEmits(['close', 'activate'])

// ── Step definitions ─────────────────────────────────────────────────────────
// type: 'interactive' | 'guided' | 'info'
// waitFor: function(props, initialSnapshot) → boolean — auto-advances when true
// hint: shown instead of Weiter-button on interactive steps
// panel/tab: emitted to App.vue so it activates the right view (mobile + desktop)

const DESKTOP_STEPS = [
  {
    type: 'info',
    selector: null,
    panel: null, tab: null,
    title: 'Gemeinsam für eine bessere Zukunft',
    icon: '🌍',
    text: 'Das Erfassen von Teilhabestörungen ist der wichtigste Schritt, um der Gesellschaft zu helfen, das WARUM von Benachteiligung und das WIE des Lebens betroffener Menschen zu verstehen. Deine Aufgabe: das Original ergänzen, verfeinern und bewerten. Arbeiten wir gemeinsam an einer Zukunft füreinander!',
  },
  {
    type: 'info',
    selector: '[data-tour="structure-panel"]',
    panel: null, tab: null,
    title: 'Das Original',
    icon: '📋',
    text: 'Beim ersten Start wird automatisch das Original geladen – die unvollständige Masterversion des Fragebogens. Links siehst du den Strukturbaum mit allen Abschnitten und Fragen. Das Original bleibt immer unverändert.',
  },
  {
    type: 'interactive',
    selector: '[data-tour="add-variant"]',
    panel: null, tab: null,
    waitFor: (p, init) => p.variantCount > init.variantCount,
    hint: 'Klicke jetzt auf „+ Neue" und lege deine persönliche Variante an.',
    title: 'Variante anlegen',
    icon: '✏️',
    text: 'Erstelle deine eigene Variante – eine Kopie des Originals, die nur du bearbeitest. Wähle einen einzigartigen Namen, z.B. Vorname_Ort_Datum. Das Original bleibt unberührt.',
  },
  {
    type: 'interactive',
    selector: '[data-tour="autosave-btn"]',
    panel: null, tab: null,
    waitFor: (p) => p.currentVariantLinked,
    hint: 'Klicke auf „↑ Auf Server speichern", um deine Variante einmalig hochzuladen.',
    title: 'Auf dem Server speichern',
    icon: '☁️',
    text: 'Speichere deine Variante einmalig manuell. Danach läuft Autosave automatisch nach jeder Änderung. Den Sync-Status siehst du am Symbol neben der Variante (✓ = synchronisiert).',
  },
  {
    type: 'interactive',
    selector: '[data-tour="structure-panel"]',
    panel: null, tab: null,
    waitFor: (p) => p.selectedId !== null,
    hint: 'Klicke im Baum links auf eine Frage oder ein Item, um es auszuwählen.',
    title: 'Frage auswählen',
    icon: '🖱️',
    text: 'Klicke im Strukturbaum auf eine Frage oder ein ICF-Item – so wählst du es zur Bearbeitung und Bewertung aus.',
  },
  {
    type: 'info',
    selector: '[data-tour="content-panel"]',
    panel: null, tab: 'editor',
    title: 'Im Editor arbeiten',
    icon: '🛠️',
    text: 'Im Editor in der Mitte bearbeitest du das ausgewählte Element. Du kannst Icon, Bezeichnung, Fragetext, Antworten und Referenz befüllen oder ändern. Gehen wir die Felder gemeinsam durch.',
  },
  {
    type: 'guided',
    selector: '[data-tour="icon-field"]',
    panel: null, tab: 'editor',
    title: 'Icon',
    icon: '🖼️',
    text: 'Jedes Element kann ein Icon haben. Klicke auf den Link „Icons suchen auf icon-sets.iconify.design ↗" – ein neuer Tab öffnet sich. Such ein passendes Icon, kopiere den Code (z.B. twemoji:man-standing) und füge ihn hier ein. Alternativ kannst du ein Bild hochladen.',
  },
  {
    type: 'guided',
    selector: '[data-tour="heading-field"]',
    panel: null, tab: 'editor',
    title: 'Überschrift',
    icon: '🔤',
    text: 'Die Bezeichnung ist der sichtbare Titel des Elements im Baum und in der Vorschau. Gib hier einen aussagekräftigen Namen ein.',
  },
  {
    type: 'guided',
    selector: '[data-tour="question-field"]',
    panel: null, tab: 'editor',
    title: 'Fragetext',
    icon: '❓',
    text: 'Der Fragetext ist die eigentliche Frage, die dem Befragten gestellt wird. Formuliere sie so, dass sie verständlich und eindeutig ist.',
  },
  {
    type: 'guided',
    selector: '[data-tour="answers-field"]',
    panel: null, tab: 'editor',
    title: 'Antwortmöglichkeiten',
    icon: '📝',
    text: 'Hier siehst du die Antwortoptionen im Vorschau-Modus. Bei Unterfragen kannst du eigene Optionen eintragen (eine pro Zeile). Mit den Buttons stellst du die Richtung gut→schlecht oder schlecht→gut ein.',
  },
  {
    type: 'guided',
    selector: '[data-tour="reference-field"]',
    panel: null, tab: 'editor',
    title: 'Referenz',
    icon: '📚',
    text: 'Kommt diese Frage aus einem validierten Fragebogen? Trage hier die Quelle ein, z.B. „WHODAS 2.0 Frage 1.1" oder „SF-36 Item 3". Das hilft beim späteren Vergleich.',
  },
  {
    type: 'interactive',
    selector: '[data-tour="preview-tab"]',
    panel: null, tab: null,
    waitFor: (p) => p.activeTab === 'preview',
    hint: 'Klicke oben auf den Tab „Vorschau", um die Fragen so zu sehen wie später die Befragten.',
    title: 'Vorschau-Tab öffnen',
    icon: '👁️',
    text: 'In der Vorschau siehst du alle Fragen der Variante so, wie sie später erscheinen werden. Hier bewertest du auch jedes Item.',
  },
  {
    type: 'interactive',
    selector: '[data-tour="rating-fields"]',
    panel: null, tab: 'preview',
    waitFor: (p, init) => p.ratingCount > init.ratingCount,
    hint: 'Vergib jetzt dein Rating für Wichtigkeit und Verständlichkeit – je 1 bis 5 Sterne.',
    title: 'Items bewerten',
    icon: '⭐',
    text: 'Bewerte jedes Item nach Wichtigkeit und Verständlichkeit auf einer Skala von 1 bis 5. Das ist dein wichtigster Beitrag! Bewertete Items erhalten im Baum ein ✓.',
  },
  {
    type: 'info',
    selector: '[data-tour="variant-points"]',
    panel: null, tab: null,
    title: 'Punkte sammeln',
    icon: '🏆',
    text: 'Du hast gerade Punkte gesammelt! Jede Aktion bringt Punkte: neue Elemente (10 Pkt), Ratings (je 2 Pkt), Felder befüllen (2 Pkt), Felder ändern (1 Pkt). Dein Gesamtstand steht im Varianten-Panel.',
  },
  {
    type: 'info',
    selector: '[data-tour="undo-btn"]',
    panel: null, tab: null,
    title: 'Undo / Redo',
    icon: '↩️',
    text: 'Jede Aktion kann mit Strg+Z rückgängig gemacht werden – bis zu 50 Schritte. Mit Strg+Y stellst du sie wieder her. Die Buttons in der Kopfzeile funktionieren genauso.',
  },
  {
    type: 'info',
    selector: '[data-tour="autosave-btn"]',
    panel: null, tab: null,
    title: 'Alles wird gespeichert',
    icon: '✅',
    text: 'Deine Variante wird nach jeder Änderung automatisch auf dem Server gesichert. Du musst nichts manuell speichern. Viel Erfolg – und herzlichen Dank für deinen Beitrag!',
  },
]

const MOBILE_STEPS = [
  {
    type: 'info',
    selector: null,
    panel: null, tab: null,
    title: 'Gemeinsam für eine bessere Zukunft',
    icon: '🌍',
    text: 'Das Erfassen von Teilhabestörungen ist der wichtigste Schritt, um der Gesellschaft zu helfen, das WARUM von Benachteiligung und das WIE des Lebens betroffener Menschen zu verstehen. Deine Aufgabe: das Original ergänzen, verfeinern und bewerten. Arbeiten wir gemeinsam an einer Zukunft füreinander!',
  },
  {
    type: 'info',
    selector: '[data-tour="structure-panel"]',
    panel: 'structure', tab: null,
    title: 'Das Original',
    icon: '📋',
    text: 'Beim ersten Start wird automatisch das Original geladen. Hier siehst du alle Abschnitte und Fragen als Baum. Das Original bleibt immer unverändert – du arbeitest nur an deiner eigenen Variante.',
  },
  {
    type: 'interactive',
    selector: '[data-tour="add-variant"]',
    panel: 'variants', tab: null,
    waitFor: (p, init) => p.variantCount > init.variantCount,
    hint: 'Tippe auf „+ Neue" und lege deine persönliche Variante an.',
    title: 'Variante anlegen',
    icon: '✏️',
    text: 'Erstelle deine eigene Variante – eine Kopie des Originals, die nur du bearbeitest. Wähle einen einzigartigen Namen, z.B. Vorname_Ort_Datum.',
  },
  {
    type: 'interactive',
    selector: '[data-tour="autosave-btn"]',
    panel: 'variants', tab: null,
    waitFor: (p) => p.currentVariantLinked,
    hint: 'Tippe auf „↑ Auf Server speichern", um deine Variante einmalig hochzuladen.',
    title: 'Auf dem Server speichern',
    icon: '☁️',
    text: 'Speichere deine Variante einmalig manuell. Danach läuft Autosave automatisch nach jeder Änderung.',
  },
  {
    type: 'interactive',
    selector: '[data-tour="structure-panel"]',
    panel: 'structure', tab: null,
    waitFor: (p) => p.selectedId !== null,
    hint: 'Tippe im Baum auf eine Frage oder ein Item, um es auszuwählen.',
    title: 'Frage auswählen',
    icon: '🖱️',
    text: 'Tippe im Strukturbaum auf eine Frage oder ein ICF-Item – so wählst du es zur Bearbeitung und Bewertung aus.',
  },
  {
    type: 'info',
    selector: '[data-tour="content-panel"]',
    panel: 'content', tab: 'editor',
    title: 'Im Editor arbeiten',
    icon: '🛠️',
    text: 'Hier bearbeitest du das ausgewählte Element: Icon, Bezeichnung, Fragetext, Antworten und Referenz. Gehen wir die Felder gemeinsam durch.',
  },
  {
    type: 'guided',
    selector: '[data-tour="icon-field"]',
    panel: 'content', tab: 'editor',
    title: 'Icon',
    icon: '🖼️',
    text: 'Tippe auf „Icons suchen auf icon-sets.iconify.design ↗" – ein neuer Tab öffnet sich. Such ein Icon, kopiere den Code (z.B. twemoji:man-standing) und füge ihn hier ein. Die Tour läuft im Hintergrund weiter.',
  },
  {
    type: 'guided',
    selector: '[data-tour="heading-field"]',
    panel: 'content', tab: 'editor',
    title: 'Überschrift',
    icon: '🔤',
    text: 'Die Bezeichnung ist der sichtbare Titel des Elements im Baum und in der Vorschau.',
  },
  {
    type: 'guided',
    selector: '[data-tour="question-field"]',
    panel: 'content', tab: 'editor',
    title: 'Fragetext',
    icon: '❓',
    text: 'Der Fragetext ist die eigentliche Frage. Formuliere sie verständlich und eindeutig.',
  },
  {
    type: 'guided',
    selector: '[data-tour="answers-field"]',
    panel: 'content', tab: 'editor',
    title: 'Antwortmöglichkeiten',
    icon: '📝',
    text: 'Hier siehst du die Antwortoptionen. Bei Unterfragen kannst du eigene Optionen eintragen. Stelle die Richtung gut→schlecht oder schlecht→gut ein.',
  },
  {
    type: 'guided',
    selector: '[data-tour="reference-field"]',
    panel: 'content', tab: 'editor',
    title: 'Referenz',
    icon: '📚',
    text: 'Kommt diese Frage aus einem validierten Fragebogen? Trage die Quelle ein, z.B. „WHODAS 2.0 Frage 1.1".',
  },
  {
    type: 'interactive',
    selector: '[data-tour="preview-tab"]',
    panel: null, tab: null,
    waitFor: (p) => p.activeTab === 'preview',
    hint: 'Tippe oben auf „Vorschau", um die Fragen so zu sehen wie später die Befragten.',
    title: 'Vorschau-Tab öffnen',
    icon: '👁️',
    text: 'In der Vorschau siehst du alle Fragen so, wie sie später erscheinen. Hier bewertest du auch jedes Item.',
  },
  {
    type: 'interactive',
    selector: '[data-tour="rating-fields"]',
    panel: 'content', tab: 'preview',
    waitFor: (p, init) => p.ratingCount > init.ratingCount,
    hint: 'Vergib jetzt dein Rating für Wichtigkeit und Verständlichkeit.',
    title: 'Items bewerten',
    icon: '⭐',
    text: 'Bewerte jedes Item nach Wichtigkeit und Verständlichkeit (1–5 Sterne). Bewertete Items erhalten im Baum ein ✓.',
  },
  {
    type: 'info',
    selector: '[data-tour="variant-points"]',
    panel: 'variants', tab: null,
    title: 'Punkte sammeln',
    icon: '🏆',
    text: 'Du hast gerade Punkte gesammelt! Neue Elemente (10 Pkt), Ratings (2 Pkt), Felder befüllen (2 Pkt). Dein Gesamtstand steht hier.',
  },
  {
    type: 'info',
    selector: '[data-tour="undo-btn"]',
    panel: null, tab: null,
    title: 'Undo / Redo',
    icon: '↩️',
    text: 'Mit den Pfeiltasten in der Kopfzeile machst du Aktionen rückgängig oder stellst sie wieder her.',
  },
  {
    type: 'info',
    selector: '[data-tour="autosave-btn"]',
    panel: 'variants', tab: null,
    title: 'Alles wird gespeichert',
    icon: '✅',
    text: 'Deine Variante wird nach jeder Änderung automatisch auf dem Server gesichert. Viel Erfolg – und herzlichen Dank für deinen Beitrag!',
  },
]

const MOBILE_BREAKPOINT = 640

// ── State ─────────────────────────────────────────────────────────────────────

const step     = ref(props.initialStep)
const isMobile = ref(window.innerWidth < MOBILE_BREAKPOINT)

const activeSteps   = computed(() => isMobile.value ? MOBILE_STEPS : DESKTOP_STEPS)
const currentStep   = computed(() => activeSteps.value[step.value])
const isLastStep    = computed(() => step.value === activeSteps.value.length - 1)
const isInteractive = computed(() => currentStep.value?.type === 'interactive')
// Overlay passiert Klicks durch sobald ein Spotlight aktiv ist (guided + interactive)
const isPassthrough = computed(() => currentStep.value?.type !== 'info')

watch(isMobile, () => { step.value = 0 })

// ── Spotlight positioning ─────────────────────────────────────────────────────

const spotlight = ref(null)
const modalPos  = ref(null)

const PADDING = 8
const MODAL_W = 460
const MODAL_H = 300
const MARGIN  = 16

function getRect(selector) {
  if (!selector) return null
  const el = document.querySelector(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return r
}

function placeModal(rect) {
  if (!rect) { modalPos.value = null; return }
  const vw = window.innerWidth
  const vh = window.innerHeight
  const spaceBelow = vh - rect.bottom - MARGIN
  const spaceAbove = rect.top - MARGIN
  const spaceRight = vw - rect.right - MARGIN
  const spaceLeft  = rect.left - MARGIN
  const clampLeft  = (l) => Math.max(MARGIN, Math.min(vw - MODAL_W - MARGIN, l))
  const clampTop   = (t) => Math.max(MARGIN, Math.min(vh - MODAL_H - MARGIN, t))
  const centerX    = rect.left + rect.width / 2 - MODAL_W / 2
  const centerY    = rect.top  + rect.height / 2 - MODAL_H / 2
  let top, left
  if      (spaceBelow >= MODAL_H) { top = rect.bottom + PADDING + 8; left = clampLeft(centerX) }
  else if (spaceAbove >= MODAL_H) { top = rect.top - MODAL_H - PADDING - 8; left = clampLeft(centerX) }
  else if (spaceRight >= MODAL_W) { left = rect.right + PADDING + 8; top = clampTop(centerY) }
  else if (spaceLeft  >= MODAL_W) { left = rect.left - MODAL_W - PADDING - 8; top = clampTop(centerY) }
  else { modalPos.value = null; return }
  modalPos.value = { top: `${Math.round(top)}px`, left: `${Math.round(left)}px` }
}

function update() {
  const rect = getRect(currentStep.value?.selector)
  if (rect) {
    spotlight.value = {
      top:    rect.top    - PADDING,
      left:   rect.left   - PADDING,
      width:  rect.width  + PADDING * 2,
      height: rect.height + PADDING * 2,
    }
    placeModal(rect)
  } else {
    spotlight.value = null
    modalPos.value  = null
  }
}

// ── Auto-advance via props ────────────────────────────────────────────────────

const initialSnapshot = ref({ variantCount: props.variantCount, ratingCount: props.ratingCount })

function takeSnapshot() {
  initialSnapshot.value = { variantCount: props.variantCount, ratingCount: props.ratingCount }
}

let advanceTimer = null

watch(
  [() => props.variantCount, () => props.selectedId, () => props.activeTab,
   () => props.currentVariantLinked, () => props.ratingCount],
  () => {
    const s = currentStep.value
    if (!s?.waitFor) return
    if (s.waitFor(props, initialSnapshot.value)) {
      clearTimeout(advanceTimer)
      advanceTimer = setTimeout(() => advance(), 600)
    }
  },
  { flush: 'sync' }
)

// ── Navigation ────────────────────────────────────────────────────────────────

function advance() {
  if (step.value < activeSteps.value.length - 1) step.value++
}

function prev() {
  if (step.value > 0) step.value--
}

function close() { emit('close') }

watch(step, async () => {
  takeSnapshot()
  const s = currentStep.value
  if (s?.panel !== undefined || s?.tab !== undefined) {
    emit('activate', { panel: s.panel ?? null, tab: s.tab ?? null })
    await nextTick()
  }
  update()
})

function onResize() {
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT
  update()
}

onMounted(async () => {
  takeSnapshot()
  const s = currentStep.value
  if (s?.panel !== undefined || s?.tab !== undefined) {
    emit('activate', { panel: s.panel ?? null, tab: s.tab ?? null })
    await nextTick()
  }
  update()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  clearTimeout(advanceTimer)
})

// ── Computed styles ───────────────────────────────────────────────────────────

const spotlightStyle = computed(() => {
  if (!spotlight.value) return null
  const { top, left, width, height } = spotlight.value
  return { top: `${top}px`, left: `${left}px`, width: `${width}px`, height: `${height}px` }
})

const modalStyle = computed(() => {
  if (!modalPos.value) return {}
  return { position: 'fixed', top: modalPos.value.top, left: modalPos.value.left, transform: 'none' }
})
</script>

<template>
  <!-- Spotlight: darkens everything except the target element -->
  <div v-if="spotlightStyle" class="tour-spotlight" :style="spotlightStyle" />

  <!-- Overlay -->
  <div
    class="modal-overlay tour-overlay"
    :class="{
      'tour-overlay--dim': !spotlightStyle,
      'tour-overlay--interactive': isPassthrough,
    }"
    @click.self="!spotlightStyle && close()"
  >
    <div class="modal onboarding-modal" :style="modalStyle">

      <button class="onboarding-close" @click="close" title="Schließen">✕</button>

      <!-- Progress dots -->
      <div class="onboarding-dots">
        <span
          v-for="(_, i) in activeSteps"
          :key="i"
          class="onboarding-dot"
          :class="{ active: i === step, done: i < step }"
          @click="!isInteractive && (step = i)"
        />
      </div>

      <!-- Step content -->
      <div class="onboarding-body">
        <div class="onboarding-icon">{{ currentStep.icon }}</div>
        <h3 class="onboarding-title">{{ currentStep.title }}</h3>
        <p class="onboarding-text">{{ currentStep.text }}</p>
      </div>

      <!-- Interactive hint (replaces Weiter button) -->
      <div v-if="isInteractive" data-testid="tour-hint" class="onboarding-hint">
        <span class="onboarding-hint-pulse">●</span>
        {{ currentStep.hint }}
      </div>

      <!-- Navigation -->
      <div v-else class="onboarding-nav">
        <span class="onboarding-counter">{{ step + 1 }} / {{ activeSteps.length }}</span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm" :disabled="step === 0" @click="prev">← Zurück</button>
          <button
            v-if="!isLastStep"
            data-testid="weiter-btn"
            class="btn btn-sm btn-primary"
            @click="advance"
          >Weiter →</button>
          <button
            v-else
            data-testid="finish-btn"
            class="btn btn-sm btn-primary"
            @click="close"
          >Starten ✓</button>
        </div>
      </div>

    </div>
  </div>
</template>
