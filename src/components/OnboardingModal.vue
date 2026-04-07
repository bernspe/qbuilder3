<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

const emit = defineEmits(['close', 'activate'])

// ── Desktop steps ─────────────────────────────────────────────────────────────
const DESKTOP_STEPS = [
  {
    selector: null,
    title: 'Willkommen beim QBuilder',
    icon: '👋',
    text: 'Gemeinsam erstellen wir eine Fragebogendatenbank zu Teilhabestörungen. Deine Aufgabe: das Original ergänzen, verfeinern und bewerten. Diese kurze Einführung zeigt dir, wie das geht.'
  },
  {
    selector: '[data-tour="structure-panel"]',
    title: 'Das Original',
    icon: '📋',
    text: 'Beim ersten Start wird automatisch das Original geladen – die unvollständige Masterversion. Links siehst du den Strukturbaum mit allen Abschnitten und Fragen. Das Original bleibt immer unverändert.'
  },
  {
    selector: '[data-tour="add-variant"]',
    title: 'Variante anlegen',
    icon: '✏️',
    text: 'Klicke auf „+ Neue", um eine eigene Variante zu erstellen. Wähle einen einzigartigen Namen, z.B. Vorname_Ort_Datum. Nur die aktive (hervorgehobene) Variante lässt sich bearbeiten.'
  },
  {
    selector: '[data-tour="autosave-btn"]',
    title: 'Auf dem Server speichern',
    icon: '☁️',
    text: 'Speichere deine Variante einmalig manuell auf dem Server. Danach läuft Autosave automatisch nach jeder Änderung. Den Sync-Status siehst du am Symbol neben der Variante (✓ = synchronisiert).'
  },
  {
    selector: '[data-tour="content-panel"]',
    title: 'Im Editor arbeiten',
    icon: '🛠️',
    text: 'Klicke ein Element im Baum an, um es im Editor zu bearbeiten: Icon, Überschrift, Frage, Antwortmöglichkeiten, Referenz. Über „+ Abschnitt" in der Kopfzeile ergänzt du neue Elemente.'
  },
  {
    selector: '[data-tour="preview-tab"]',
    title: 'Vorschau & Rating',
    icon: '👁️',
    text: 'Wechsle zur Vorschau-Ansicht, um Fragen so zu sehen, wie sie später erscheinen. Bewerte jedes Item nach Wichtigkeit und Verständlichkeit auf einer Skala von 1 bis 5.'
  },
  {
    selector: '[data-tour="structure-panel"]',
    title: 'Fortschritt im Baum',
    icon: '✅',
    text: 'Bewertete Items werden im Baum mit einem Häkchen markiert – so erkennst du sofort, welche Elemente du schon bewertet hast und welche noch ausstehen.'
  },
  {
    selector: '[data-tour="variant-points"]',
    title: 'Punkte sammeln',
    icon: '🏆',
    text: 'Jede Aktion bringt Punkte: neue Elemente (10 Pkt), Ratings (je 2 Pkt), Felder befüllen (2 Pkt), Felder ändern (1 Pkt). Die Gesamtpunktzahl deiner Variante siehst du hier im Varianten-Panel.'
  },
  {
    selector: '[data-tour="undo-btn"]',
    title: 'Undo / Redo',
    icon: '↩️',
    text: 'Jede Aktion kann mit Strg+Z rückgängig gemacht werden – bis zu 50 Schritte. Mit Strg+Y kannst du sie wieder herstellen. Oder nutze die Buttons direkt in der Kopfzeile.'
  },
  {
    selector: null,
    title: 'Das gemeinsame Ziel',
    icon: '🎯',
    text: 'Nach Eingang ausreichend vieler Varianten und Bewertungen entsteht eine finale Fragebogendatenbank für die Teilhabeforschung. Herzlichen Dank für deine Mitarbeit!'
  }
]

// ── Mobile steps (panel + tab steuern die App-Ansicht vor dem Spotlight) ───────
const MOBILE_STEPS = [
  {
    panel: null, tab: null,
    selector: null,
    title: 'Willkommen beim QBuilder',
    icon: '👋',
    text: 'Gemeinsam erstellen wir eine Fragebogendatenbank zu Teilhabestörungen. Deine Aufgabe: das Original ergänzen, verfeinern und bewerten. Diese kurze Einführung zeigt dir, wie das geht.'
  },
  {
    panel: 'structure', tab: null,
    selector: '[data-tour="structure-panel"]',
    title: 'Der Strukturbaum',
    icon: '📋',
    text: 'Hier siehst du das Original – die Masterversion des Fragebogens. Alle Abschnitte und Fragen sind als Baum dargestellt. Das Original bleibt immer unverändert.'
  },
  {
    panel: 'content', tab: 'editor',
    selector: '[data-tour="content-panel"]',
    title: 'Editor',
    icon: '🛠️',
    text: 'Wähle ein Element im Baum aus, um es hier zu bearbeiten: Icon, Überschrift, Frage, Antwortmöglichkeiten und Referenz. Neue Elemente fügst du über „+ Abschnitt" in der Kopfzeile hinzu.'
  },
  {
    panel: 'content', tab: 'preview',
    selector: '[data-tour="preview-tab"]',
    title: 'Vorschau-Tab',
    icon: '👁️',
    text: 'Der Vorschau-Tab zeigt Fragen so, wie sie später aussehen. Hier bewertest du jedes Item nach Wichtigkeit und Verständlichkeit – das ist dein wichtigster Beitrag!'
  },
  {
    panel: 'content', tab: 'preview',
    selector: '[data-tour="content-panel"]',
    title: 'Items bewerten',
    icon: '⭐',
    text: 'Klicke ein Element im Baum an und vergib hier dein Rating auf einer Skala von 1 bis 5. Bewertete Items werden im Baum mit einem ✓ markiert.'
  },
  {
    panel: 'variants', tab: null,
    selector: '[data-tour="variants-panel"]',
    title: 'Varianten-Panel',
    icon: '◈',
    text: 'Hier verwaltest du deine Varianten. Jede Variante ist eine eigenständige Kopie, die du unabhängig bearbeiten und bewerten kannst.'
  },
  {
    panel: 'variants', tab: null,
    selector: '[data-tour="add-variant"]',
    title: 'Variante anlegen',
    icon: '✏️',
    text: 'Tippe auf „+ Neue", um deine eigene Variante zu erstellen. Wähle einen eindeutigen Namen, z.B. Vorname_Ort_Datum. Nur die aktive Variante lässt sich bearbeiten.'
  },
  {
    panel: 'variants', tab: null,
    selector: '[data-tour="autosave-btn"]',
    title: 'Auf dem Server speichern',
    icon: '☁️',
    text: 'Speichere deine Variante einmalig manuell. Danach läuft Autosave automatisch nach jeder Änderung. Den Sync-Status siehst du am Symbol neben der Variante (✓ = synchronisiert).'
  },
  {
    panel: null, tab: null,
    selector: '[data-tour="undo-btn"]',
    title: 'Undo / Redo',
    icon: '↩️',
    text: 'Tippst du aus Versehen falsch? Kein Problem – mit den Pfeiltasten in der Kopfzeile machst du Aktionen rückgängig oder stellst sie wieder her.'
  },
  {
    panel: null, tab: null,
    selector: null,
    title: 'Das gemeinsame Ziel',
    icon: '🎯',
    text: 'Nach Eingang ausreichend vieler Varianten und Bewertungen entsteht eine finale Fragebogendatenbank für die Teilhabeforschung. Herzlichen Dank für deine Mitarbeit!'
  }
]

const MOBILE_BREAKPOINT = 640

const step    = ref(0)
const isMobile = ref(window.innerWidth < MOBILE_BREAKPOINT)

const activeSteps = computed(() => isMobile.value ? MOBILE_STEPS : DESKTOP_STEPS)

// Reset to step 0 when switching between mobile/desktop mid-tour
watch(isMobile, () => { step.value = 0 })

// Spotlight: position/size of the highlighted element
const spotlight = ref(null)   // { top, left, width, height } or null
const modalPos  = ref(null)   // { top, left } or null (null = centered)

const PADDING    = 8   // px around the highlighted element
const MODAL_W    = 460
const MODAL_H    = 300 // approximate
const MARGIN     = 16

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

  const spaceBelow  = vh - rect.bottom - MARGIN
  const spaceAbove  = rect.top - MARGIN
  const spaceRight  = vw - rect.right - MARGIN
  const spaceLeft   = rect.left - MARGIN

  let top, left

  const clampLeft = (l) => Math.max(MARGIN, Math.min(vw - MODAL_W - MARGIN, l))
  const clampTop  = (t) => Math.max(MARGIN, Math.min(vh - MODAL_H - MARGIN, t))
  const centerX   = rect.left + rect.width / 2 - MODAL_W / 2
  const centerY   = rect.top  + rect.height / 2 - MODAL_H / 2

  if (spaceBelow >= MODAL_H) {
    top  = rect.bottom + PADDING + 8
    left = clampLeft(centerX)
  } else if (spaceAbove >= MODAL_H) {
    top  = rect.top - MODAL_H - PADDING - 8
    left = clampLeft(centerX)
  } else if (spaceRight >= MODAL_W) {
    left = rect.right + PADDING + 8
    top  = clampTop(centerY)
  } else if (spaceLeft >= MODAL_W) {
    left = rect.left - MODAL_W - PADDING - 8
    top  = clampTop(centerY)
  } else {
    // fallback: center
    modalPos.value = null
    return
  }

  modalPos.value = { top: `${Math.round(top)}px`, left: `${Math.round(left)}px` }
}

function update() {
  const s    = activeSteps.value[step.value]
  const rect = getRect(s?.selector)

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

watch(step, async () => {
  const s = activeSteps.value[step.value]
  // For mobile steps: activate the required panel/tab first, then wait for DOM update
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
  // Emit initial activate for first mobile step if needed
  const s = activeSteps.value[step.value]
  if (s?.panel !== undefined || s?.tab !== undefined) {
    emit('activate', { panel: s.panel ?? null, tab: s.tab ?? null })
    await nextTick()
  }
  update()
  window.addEventListener('resize', onResize)
})
onUnmounted(() => window.removeEventListener('resize', onResize))

const spotlightStyle = computed(() => {
  if (!spotlight.value) return null
  const { top, left, width, height } = spotlight.value
  return { top: `${top}px`, left: `${left}px`, width: `${width}px`, height: `${height}px` }
})

const modalStyle = computed(() => {
  if (!modalPos.value) return {}
  return { position: 'fixed', top: modalPos.value.top, left: modalPos.value.left, transform: 'none' }
})

function next()  { if (step.value < activeSteps.value.length - 1) step.value++ }
function prev()  { if (step.value > 0) step.value-- }
function close() { emit('close') }
</script>

<template>
  <!-- Spotlight: darkens everything except the target element -->
  <div v-if="spotlightStyle" class="tour-spotlight" :style="spotlightStyle" />

  <!-- Overlay: transparent when spotlight active, opaque when centered -->
  <div class="modal-overlay tour-overlay" :class="{ 'tour-overlay--dim': !spotlightStyle }" @click.self="close">
    <div class="modal onboarding-modal" :style="modalStyle">

      <button class="onboarding-close" @click="close" title="Schließen">✕</button>

      <!-- Progress dots -->
      <div class="onboarding-dots">
        <span
          v-for="(_, i) in activeSteps"
          :key="i"
          class="onboarding-dot"
          :class="{ active: i === step, done: i < step }"
          @click="step = i"
        />
      </div>

      <!-- Step content -->
      <div class="onboarding-body">
        <div class="onboarding-icon">{{ activeSteps[step].icon }}</div>
        <h3 class="onboarding-title">{{ activeSteps[step].title }}</h3>
        <p class="onboarding-text">{{ activeSteps[step].text }}</p>
      </div>

      <!-- Navigation -->
      <div class="onboarding-nav">
        <span class="onboarding-counter">{{ step + 1 }} / {{ activeSteps.length }}</span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm" :disabled="step === 0" @click="prev">← Zurück</button>
          <button v-if="step < activeSteps.length - 1" class="btn btn-sm btn-primary" @click="next">Weiter →</button>
          <button v-else class="btn btn-sm btn-primary" @click="close">Starten ✓</button>
        </div>
      </div>

    </div>
  </div>
</template>
