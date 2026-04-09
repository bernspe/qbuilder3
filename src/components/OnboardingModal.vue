<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  variantCount:         { type: Number,  default: 1 },
  selectedId:           { type: String,  default: null },
  selectedNodeType:     { type: String,  default: null },
  activeTab:            { type: String,  default: 'editor' },
  currentVariantLinked: { type: Boolean, default: false },
  ratingCount:          { type: Number,  default: 0 },
  // for tests: jump directly to a step and bypass the choice screen
  initialStep:          { type: Number,  default: 0 },
  initialMode:          { type: String,  default: null }, // 'full' | 'quick'
})

const emit = defineEmits(['close', 'activate'])

// ── Step definitions ─────────────────────────────────────────────────────────
// type: 'interactive' | 'guided' | 'info'
// waitFor: function(props, initialSnapshot) → boolean — auto-advances when true
// hint: shown instead of Weiter-button on interactive steps
// panel/tab: emitted to App.vue so it activates the right view (mobile + desktop)

const DESKTOP_STEPS = [
  // 0
  {
    type: 'info',
    selector: null,
    panel: null, tab: null,
    title: 'Gemeinsam für eine bessere Zukunft',
    icon: '🌍',
    text: 'Das Erfassen von Teilhabestörungen ist der wichtigste Schritt, um der Gesellschaft zu helfen, das WARUM von Benachteiligung und das WIE des Lebens betroffener Menschen zu verstehen. Deine Aufgabe: das Original ergänzen, verfeinern und bewerten. Arbeiten wir gemeinsam an einer Zukunft füreinander!',
  },
  // 1
  {
    type: 'info',
    selector: '[data-tour="structure-panel"]',
    panel: null, tab: null,
    title: 'Das Original',
    icon: '📋',
    text: 'Beim ersten Start wird automatisch das Original geladen – die unvollständige Masterversion des Fragebogens. Links siehst du den Strukturbaum mit allen Abschnitten und Fragen. Das Original bleibt immer unverändert.',
  },
  // 2
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
  // 3
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
  // 4
  {
    type: 'interactive',
    selector: '[data-tour="structure-panel"]',
    panel: null, tab: null,
    waitFor: (p) => p.selectedNodeType === 'question',
    warnIf:  (p) => p.selectedId !== null && p.selectedNodeType !== 'question',
    warnMsg: 'Das ist keine Screeningfrage. Bitte wähle ein Element mit ◉ im Baum aus.',
    hint: 'Klicke im Baum auf eine Screeningfrage (◉) – nicht auf einen Abschnitt oder ein ICF-Item.',
    title: 'Screeningfrage auswählen',
    icon: '🖱️',
    text: 'Klicke im Strukturbaum auf eine Screeningfrage (◉) – so wählst du sie zur Bearbeitung aus. Wir schauen uns nun alle Felder gemeinsam an.',
  },
  // 5
  {
    type: 'info',
    selector: '[data-tour="content-panel"]',
    panel: null, tab: 'editor',
    title: 'Im Editor arbeiten',
    icon: '🛠️',
    text: 'Im Editor in der Mitte bearbeitest du das ausgewählte Element. Du kannst Icon, Bezeichnung, Fragetext, Antworten und Referenz befüllen oder ändern. Gehen wir die Felder gemeinsam durch.',
  },
  // 6
  {
    type: 'guided',
    selector: '[data-tour="icon-field"]',
    panel: null, tab: 'editor',
    title: 'Icon',
    icon: '🖼️',
    text: 'Jedes Element kann ein Icon haben. Klicke auf den Link „Icons suchen auf icon-sets.iconify.design ↗" – ein neuer Tab öffnet sich. Such ein passendes Icon, kopiere den Code (z.B. twemoji:man-standing) und füge ihn hier ein. Alternativ kannst du ein Bild hochladen.',
  },
  // 7
  {
    type: 'guided',
    selector: '[data-tour="heading-field"]',
    panel: null, tab: 'editor',
    title: 'Überschrift',
    icon: '🔤',
    text: 'Die Bezeichnung ist der sichtbare Titel des Elements im Baum und in der Vorschau. Gib hier einen aussagekräftigen Namen ein.',
  },
  // 8
  {
    type: 'guided',
    selector: '[data-tour="question-field"]',
    panel: null, tab: 'editor',
    title: 'Fragetext',
    icon: '❓',
    text: 'Der Fragetext ist die eigentliche Frage, die dem Befragten gestellt wird. Formuliere sie so, dass sie verständlich und eindeutig ist.',
  },
  // 9
  {
    type: 'guided',
    selector: '[data-tour="answers-field"]',
    panel: null, tab: 'editor',
    title: 'Antwortmöglichkeiten',
    icon: '📝',
    text: 'Hier siehst du die Antwortoptionen im Vorschau-Modus. Bei Unterfragen kannst du eigene Optionen eintragen (eine pro Zeile). Mit den Buttons stellst du die Richtung gut→schlecht oder schlecht→gut ein.',
  },
  // 10
  {
    type: 'guided',
    selector: '[data-tour="reference-field"]',
    panel: null, tab: 'editor',
    title: 'Referenz',
    icon: '📚',
    text: 'Kommt diese Frage aus einem validierten Fragebogen? Trage hier die Quelle ein, z.B. „WHODAS 2.0 Frage 1.1" oder „SF-36 Item 3". Das hilft beim späteren Vergleich.',
  },
  // 11 – Neue Unterfrage anlegen
  {
    type: 'interactive',
    selector: '[data-tour="add-subquestion"]',
    panel: null, tab: 'editor',
    waitFor: (p) => p.selectedNodeType === 'subquestion',
    warnIf:  (p) => p.selectedNodeType === 'icf',
    warnMsg: 'Du hast ein ICF-Item hinzugefügt. Wähle die übergeordnete Screeningfrage im Baum an und klicke dann auf „+ Unterfrage".',
    hint: 'Klicke auf „+ Unterfrage", um eine präzisierende Unterfrage hinzuzufügen.',
    title: 'Unterfrage hinzufügen',
    icon: '➕',
    text: 'Mit einer Unterfrage kannst du die Hauptfrage präzisieren und differenziertere Informationen erfassen. Klicke auf „+ Unterfrage" unterhalb des Editors.',
  },
  // 12 – Unterfrage: Icon
  {
    type: 'guided',
    selector: '[data-tour="icon-field"]',
    panel: null, tab: 'editor',
    title: 'Unterfrage: Icon',
    icon: '🖼️',
    text: 'Auch die Unterfrage kann ein eigenes Icon erhalten. Suche ein passendes Icon auf iconify.design oder lade ein Bild hoch.',
  },
  // 13 – Unterfrage: Überschrift
  {
    type: 'guided',
    selector: '[data-tour="heading-field"]',
    panel: null, tab: 'editor',
    title: 'Unterfrage: Bezeichnung',
    icon: '🔤',
    text: 'Gib der Unterfrage eine prägnante Bezeichnung, die den Aspekt beschreibt, den sie erfasst.',
  },
  // 14 – Unterfrage: Fragetext
  {
    type: 'guided',
    selector: '[data-tour="question-field"]',
    panel: null, tab: 'editor',
    title: 'Unterfrage: Fragetext',
    icon: '❓',
    text: 'Formuliere den Fragetext der Unterfrage. Er sollte sich direkt auf den Aspekt beziehen, den die Hauptfrage präzisiert.',
  },
  // 15 – Unterfrage: Antworten
  {
    type: 'guided',
    selector: '[data-tour="answers-field"]',
    panel: null, tab: 'editor',
    title: 'Unterfrage: Antwortoptionen',
    icon: '📝',
    text: 'Bei Unterfragen kannst du eigene Antwortoptionen eingeben (eine pro Zeile) oder die Standardskala verwenden. Stelle die Richtung gut→schlecht oder schlecht→gut ein.',
  },
  // 16 – Unterfrage: Referenz
  {
    type: 'guided',
    selector: '[data-tour="reference-field"]',
    panel: null, tab: 'editor',
    title: 'Unterfrage: Referenz',
    icon: '📚',
    text: 'Falls diese Unterfrage aus einem validierten Instrument stammt, trage die Quelle ein. Danach kehren wir zum Strukturbaum zurück, um ein ICF-Item auszuwählen.',
  },
  // 17 – ICF-Item auswählen
  {
    type: 'interactive',
    selector: '[data-tour="structure-panel"]',
    panel: null, tab: null,
    waitFor: (p) => p.selectedNodeType === 'icf',
    warnIf:  (p) => p.selectedId !== null && p.selectedNodeType !== 'icf',
    warnMsg: 'Das ist kein ICF-Item. Bitte wähle ein Element mit ⊞ im Baum aus.',
    hint: 'Klicke im Baum auf ein ICF-Item (⊞) – erkennbar am ICF-Badge.',
    title: 'ICF-Item auswählen',
    icon: '🔬',
    text: 'ICF-Items verknüpfen deine Fragen mit der internationalen Klassifikation der Funktionsfähigkeit. Wähle im Strukturbaum ein ICF-Item (⊞) aus, um es zu bearbeiten.',
  },
  // 18 – ICF-Editor Info
  {
    type: 'info',
    selector: '[data-tour="content-panel"]',
    panel: null, tab: 'editor',
    title: 'ICF-Editor',
    icon: '🏥',
    text: 'Der ICF-Editor zeigt dir alle Felder eines ICF-Items. Gehen wir die wichtigsten Felder durch: zuerst den ICF-Code, dann den Fragetext.',
  },
  // 19 – ICF-Code
  {
    type: 'guided',
    selector: '[data-tour="icf-code-field"]',
    panel: null, tab: 'editor',
    title: 'ICF-Code',
    icon: '🔢',
    text: 'Der ICF-Code identifiziert das Konzept eindeutig (z.B. d415 für „Körperposition halten"). Über den ICF Mapper kannst du aus normaler Sprache ICF-Codes generieren – klicke auf den Link, um das Tool auszuprobieren.',
  },
  // 20 – ICF Fragetext + Beispielfragen
  {
    type: 'guided',
    selector: '[data-tour="icf-question-field"]',
    panel: null, tab: 'editor',
    title: 'ICF Fragetext',
    icon: '💬',
    text: 'Formuliere eine Frage, die das ICF-Konzept für Betroffene verständlich macht. Klicke auf eine der Beispielfragen, um sie zu übernehmen – oder schreibe deine eigene.',
  },
  // 21 – Vorschau Tab
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
  // 22 – Rating
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
  // 23 – Punkte
  {
    type: 'info',
    selector: '[data-tour="variant-points"]',
    panel: null, tab: null,
    title: 'Punkte sammeln',
    icon: '🏆',
    text: 'Du hast gerade Punkte gesammelt! Jede Aktion bringt Punkte: neue Elemente (10 Pkt), Ratings (je 2 Pkt), Felder befüllen (2 Pkt), Felder ändern (1 Pkt). Dein Gesamtstand steht im Varianten-Panel.',
  },
  // 24 – Undo
  {
    type: 'info',
    selector: '[data-tour="undo-btn"]',
    panel: null, tab: null,
    title: 'Undo / Redo',
    icon: '↩️',
    text: 'Jede Aktion kann mit Strg+Z rückgängig gemacht werden – bis zu 50 Schritte. Mit Strg+Y stellst du sie wieder her. Die Buttons in der Kopfzeile funktionieren genauso.',
  },
  // 25 – Autosave
  {
    type: 'info',
    selector: '[data-tour="autosave-btn"]',
    panel: null, tab: null,
    title: 'Alles wird gespeichert',
    icon: '✅',
    text: 'Deine Variante wird nach jeder Änderung automatisch auf dem Server gesichert. Du musst nichts manuell speichern.',
  },
  // 26 – Call to action
  {
    type: 'info',
    selector: '[data-tour="structure-panel"]',
    panel: null, tab: null,
    title: 'Los geht\'s!',
    icon: '🚀',
    text: 'Du kennst jetzt alle wichtigen Funktionen. Wähle weitere Fragen im Baum aus, ergänze und bewerte sie. Nach Eingang ausreichend vieler Beiträge wird die finale Fragebogendatenbank erstellt. Herzlichen Dank für deinen Beitrag!',
  },
]

const MOBILE_STEPS = [
  // 0
  {
    type: 'info',
    selector: null,
    panel: null, tab: null,
    title: 'Gemeinsam für eine bessere Zukunft',
    icon: '🌍',
    text: 'Das Erfassen von Teilhabestörungen ist der wichtigste Schritt, um der Gesellschaft zu helfen, das WARUM von Benachteiligung und das WIE des Lebens betroffener Menschen zu verstehen. Deine Aufgabe: das Original ergänzen, verfeinern und bewerten. Arbeiten wir gemeinsam an einer Zukunft füreinander!',
  },
  // 1
  {
    type: 'info',
    selector: '[data-tour="structure-panel"]',
    panel: 'structure', tab: null,
    title: 'Das Original',
    icon: '📋',
    text: 'Beim ersten Start wird automatisch das Original geladen. Hier siehst du alle Abschnitte und Fragen als Baum. Das Original bleibt immer unverändert – du arbeitest nur an deiner eigenen Variante.',
  },
  // 2
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
  // 3
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
  // 4
  {
    type: 'interactive',
    selector: '[data-tour="structure-panel"]',
    panel: 'structure', tab: null,
    waitFor: (p) => p.selectedNodeType === 'question',
    warnIf:  (p) => p.selectedId !== null && p.selectedNodeType !== 'question',
    warnMsg: 'Das ist keine Screeningfrage. Bitte wähle ein Element mit ◉ im Baum aus.',
    hint: 'Tippe im Baum auf eine Screeningfrage (◉) – nicht auf einen Abschnitt.',
    title: 'Screeningfrage auswählen',
    icon: '🖱️',
    text: 'Tippe im Strukturbaum auf eine Screeningfrage (◉) – so wählst du sie zur Bearbeitung aus.',
  },
  // 5
  {
    type: 'info',
    selector: '[data-tour="content-panel"]',
    panel: 'content', tab: 'editor',
    title: 'Im Editor arbeiten',
    icon: '🛠️',
    text: 'Hier bearbeitest du das ausgewählte Element: Icon, Bezeichnung, Fragetext, Antworten und Referenz. Gehen wir die Felder gemeinsam durch.',
  },
  // 6
  {
    type: 'guided',
    selector: '[data-tour="icon-field"]',
    panel: 'content', tab: 'editor',
    title: 'Icon',
    icon: '🖼️',
    text: 'Tippe auf „Icons suchen auf icon-sets.iconify.design ↗" – ein neuer Tab öffnet sich. Such ein Icon, kopiere den Code (z.B. twemoji:man-standing) und füge ihn hier ein. Die Tour läuft im Hintergrund weiter.',
  },
  // 7
  {
    type: 'guided',
    selector: '[data-tour="heading-field"]',
    panel: 'content', tab: 'editor',
    title: 'Überschrift',
    icon: '🔤',
    text: 'Die Bezeichnung ist der sichtbare Titel des Elements im Baum und in der Vorschau.',
  },
  // 8
  {
    type: 'guided',
    selector: '[data-tour="question-field"]',
    panel: 'content', tab: 'editor',
    title: 'Fragetext',
    icon: '❓',
    text: 'Der Fragetext ist die eigentliche Frage. Formuliere sie verständlich und eindeutig.',
  },
  // 9
  {
    type: 'guided',
    selector: '[data-tour="answers-field"]',
    panel: 'content', tab: 'editor',
    title: 'Antwortmöglichkeiten',
    icon: '📝',
    text: 'Hier siehst du die Antwortoptionen. Bei Unterfragen kannst du eigene Optionen eintragen. Stelle die Richtung gut→schlecht oder schlecht→gut ein.',
  },
  // 10
  {
    type: 'guided',
    selector: '[data-tour="reference-field"]',
    panel: 'content', tab: 'editor',
    title: 'Referenz',
    icon: '📚',
    text: 'Kommt diese Frage aus einem validierten Fragebogen? Trage die Quelle ein, z.B. „WHODAS 2.0 Frage 1.1".',
  },
  // 11
  {
    type: 'interactive',
    selector: '[data-tour="add-subquestion"]',
    panel: 'content', tab: 'editor',
    waitFor: (p) => p.selectedNodeType === 'subquestion',
    warnIf:  (p) => p.selectedNodeType === 'icf',
    warnMsg: 'Du hast ein ICF-Item hinzugefügt. Wähle die übergeordnete Screeningfrage im Baum an und tippe dann auf „+ Unterfrage".',
    hint: 'Tippe auf „+ Unterfrage", um eine präzisierende Unterfrage hinzuzufügen.',
    title: 'Unterfrage hinzufügen',
    icon: '➕',
    text: 'Mit einer Unterfrage kannst du die Hauptfrage präzisieren. Tippe auf „+ Unterfrage" unterhalb des Editors.',
  },
  // 12
  {
    type: 'guided',
    selector: '[data-tour="icon-field"]',
    panel: 'content', tab: 'editor',
    title: 'Unterfrage: Icon',
    icon: '🖼️',
    text: 'Auch die Unterfrage kann ein eigenes Icon erhalten.',
  },
  // 13
  {
    type: 'guided',
    selector: '[data-tour="heading-field"]',
    panel: 'content', tab: 'editor',
    title: 'Unterfrage: Bezeichnung',
    icon: '🔤',
    text: 'Gib der Unterfrage eine prägnante Bezeichnung.',
  },
  // 14
  {
    type: 'guided',
    selector: '[data-tour="question-field"]',
    panel: 'content', tab: 'editor',
    title: 'Unterfrage: Fragetext',
    icon: '❓',
    text: 'Formuliere den Fragetext der Unterfrage, bezogen auf den Aspekt der Hauptfrage.',
  },
  // 15
  {
    type: 'guided',
    selector: '[data-tour="answers-field"]',
    panel: 'content', tab: 'editor',
    title: 'Unterfrage: Antwortoptionen',
    icon: '📝',
    text: 'Gib eigene Antwortoptionen ein oder verwende die Standardskala.',
  },
  // 16
  {
    type: 'guided',
    selector: '[data-tour="reference-field"]',
    panel: 'content', tab: 'editor',
    title: 'Unterfrage: Referenz',
    icon: '📚',
    text: 'Falls aus einem validierten Instrument, trage die Quelle ein. Danach wählen wir ein ICF-Item.',
  },
  // 17
  {
    type: 'interactive',
    selector: '[data-tour="structure-panel"]',
    panel: 'structure', tab: null,
    waitFor: (p) => p.selectedNodeType === 'icf',
    warnIf:  (p) => p.selectedId !== null && p.selectedNodeType !== 'icf',
    warnMsg: 'Das ist kein ICF-Item. Bitte wähle ein Element mit ⊞ im Baum aus.',
    hint: 'Tippe im Baum auf ein ICF-Item (⊞) – erkennbar am ICF-Badge.',
    title: 'ICF-Item auswählen',
    icon: '🔬',
    text: 'ICF-Items verknüpfen deine Fragen mit der internationalen Klassifikation der Funktionsfähigkeit. Wähle ein ICF-Item (⊞) im Baum aus.',
  },
  // 18
  {
    type: 'info',
    selector: '[data-tour="content-panel"]',
    panel: 'content', tab: 'editor',
    title: 'ICF-Editor',
    icon: '🏥',
    text: 'Der ICF-Editor zeigt dir alle Felder eines ICF-Items. Gehen wir die wichtigsten durch: ICF-Code und Fragetext.',
  },
  // 19
  {
    type: 'guided',
    selector: '[data-tour="icf-code-field"]',
    panel: 'content', tab: 'editor',
    title: 'ICF-Code',
    icon: '🔢',
    text: 'Der ICF-Code identifiziert das Konzept eindeutig (z.B. d415). Über den ICF Mapper kannst du aus normaler Sprache ICF-Codes generieren.',
  },
  // 20
  {
    type: 'guided',
    selector: '[data-tour="icf-question-field"]',
    panel: 'content', tab: 'editor',
    title: 'ICF Fragetext',
    icon: '💬',
    text: 'Formuliere eine verständliche Frage zum ICF-Konzept oder klicke auf eine Beispielfrage.',
  },
  // 21
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
  // 22
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
  // 23
  {
    type: 'info',
    selector: '[data-tour="variant-points"]',
    panel: 'variants', tab: null,
    title: 'Punkte sammeln',
    icon: '🏆',
    text: 'Du hast gerade Punkte gesammelt! Neue Elemente (10 Pkt), Ratings (2 Pkt), Felder befüllen (2 Pkt). Dein Gesamtstand steht hier.',
  },
  // 24
  {
    type: 'info',
    selector: '[data-tour="undo-btn"]',
    panel: null, tab: null,
    title: 'Undo / Redo',
    icon: '↩️',
    text: 'Mit den Pfeiltasten in der Kopfzeile machst du Aktionen rückgängig oder stellst sie wieder her.',
  },
  // 25
  {
    type: 'info',
    selector: '[data-tour="autosave-btn"]',
    panel: 'variants', tab: null,
    title: 'Alles wird gespeichert',
    icon: '✅',
    text: 'Deine Variante wird nach jeder Änderung automatisch auf dem Server gesichert.',
  },
  // 26
  {
    type: 'info',
    selector: '[data-tour="structure-panel"]',
    panel: 'structure', tab: null,
    title: 'Los geht\'s!',
    icon: '🚀',
    text: 'Du kennst jetzt alle wichtigen Funktionen. Wähle weitere Fragen im Baum aus, ergänze und bewerte sie. Herzlichen Dank für deinen Beitrag!',
  },
]

// ── Kurzübersicht (Quick Tour) ────────────────────────────────────────────────

const QUICK_DESKTOP_STEPS = [
  {
    type: 'info', selector: null, panel: null, tab: null,
    title: 'QBuilder auf einen Blick', icon: '🌍',
    text: 'Das Erfassen von Teilhabestörungen hilft der Gesellschaft, das WARUM von Benachteiligung zu verstehen. Deine Aufgabe: das Original ergänzen, verfeinern und bewerten.',
  },
  {
    type: 'info', selector: '[data-tour="add-variant"]', panel: null, tab: null,
    title: 'Deine Variante', icon: '✏️',
    text: 'Lege eine eigene Variante an – eine Kopie des Originals, die nur du bearbeitest. Speichere sie einmalig auf dem Server; danach läuft der Autosave automatisch nach jeder Änderung.',
  },
  {
    type: 'info', selector: '[data-tour="structure-panel"]', panel: null, tab: null,
    title: 'Strukturbaum', icon: '📋',
    text: 'Im Strukturbaum links siehst du alle Abschnitte, Screeningfragen, Unterfragen und ICF-Items. Klicke auf ein Element, um es im Editor zu bearbeiten.',
  },
  {
    type: 'info', selector: '[data-tour="content-panel"]', panel: null, tab: 'editor',
    title: 'Editor', icon: '🛠️',
    text: 'Im Editor befüllst du Icon, Bezeichnung, Fragetext und Antwortmöglichkeiten. Du kannst Unterfragen und ICF-Items hinzufügen, um präzisere Informationen zu erfassen.',
  },
  {
    type: 'info', selector: '[data-tour="preview-tab"]', panel: null, tab: 'preview',
    title: 'Vorschau & Bewertung', icon: '⭐',
    text: 'Im Vorschau-Tab siehst du die Fragen wie die Befragten sie sehen. Bewerte jedes Item nach Wichtigkeit und Verständlichkeit (1–5 Sterne) – das ist dein wichtigster Beitrag!',
  },
  {
    type: 'info', selector: null, panel: null, tab: null,
    title: 'Los geht\'s!', icon: '🚀',
    text: 'Das war die Kurzübersicht! Die vollständige Tour mit Schritt-für-Schritt-Anleitung kannst du jederzeit über das Menü neu starten. Viel Erfolg und herzlichen Dank!',
  },
]

const QUICK_MOBILE_STEPS = [
  {
    type: 'info', selector: null, panel: null, tab: null,
    title: 'QBuilder auf einen Blick', icon: '🌍',
    text: 'Das Erfassen von Teilhabestörungen hilft der Gesellschaft, das WARUM von Benachteiligung zu verstehen. Deine Aufgabe: das Original ergänzen, verfeinern und bewerten.',
  },
  {
    type: 'info', selector: '[data-tour="add-variant"]', panel: 'variants', tab: null,
    title: 'Deine Variante', icon: '✏️',
    text: 'Lege eine eigene Variante an und speichere sie einmalig auf dem Server. Danach läuft der Autosave automatisch.',
  },
  {
    type: 'info', selector: '[data-tour="structure-panel"]', panel: 'structure', tab: null,
    title: 'Strukturbaum', icon: '📋',
    text: 'Im Strukturbaum siehst du alle Abschnitte und Fragen. Tippe auf ein Element, um es im Editor zu bearbeiten.',
  },
  {
    type: 'info', selector: '[data-tour="content-panel"]', panel: 'content', tab: 'editor',
    title: 'Editor', icon: '🛠️',
    text: 'Im Editor befüllst du Icon, Bezeichnung, Fragetext und Antwortmöglichkeiten.',
  },
  {
    type: 'info', selector: '[data-tour="preview-tab"]', panel: 'content', tab: 'preview',
    title: 'Vorschau & Bewertung', icon: '⭐',
    text: 'Im Vorschau-Tab bewertest du jedes Item nach Wichtigkeit und Verständlichkeit (1–5 Sterne).',
  },
  {
    type: 'info', selector: null, panel: null, tab: null,
    title: 'Los geht\'s!', icon: '🚀',
    text: 'Die vollständige Tour kannst du jederzeit neu starten. Viel Erfolg und herzlichen Dank!',
  },
]

const MOBILE_BREAKPOINT = 640

// ── State ─────────────────────────────────────────────────────────────────────

const step     = ref(props.initialStep)
const isMobile = ref(window.innerWidth < MOBILE_BREAKPOINT)
// null = choice screen, 'full' = complete tour, 'quick' = short overview
const tourMode = ref(props.initialMode)

const activeSteps   = computed(() => {
  if (tourMode.value === 'quick') return isMobile.value ? QUICK_MOBILE_STEPS : QUICK_DESKTOP_STEPS
  return isMobile.value ? MOBILE_STEPS : DESKTOP_STEPS
})
const currentStep   = computed(() => activeSteps.value[step.value])
const isLastStep    = computed(() => step.value === activeSteps.value.length - 1)
const isInteractive = computed(() => currentStep.value?.type === 'interactive')
// Overlay passiert Klicks durch sobald ein Spotlight aktiv ist (guided + interactive)
// Auf dem Choice-Screen: nie passthrough (kein Spotlight)
const isPassthrough = computed(() => tourMode.value !== null && currentStep.value?.type !== 'info')

// Warning shown when the user selects the wrong node type on a validated interactive step
const validationWarning = computed(() => {
  const s = currentStep.value
  if (!s?.warnIf || !s?.warnMsg) return null
  return s.warnIf(props, initialSnapshot.value) ? s.warnMsg : null
})

watch(isMobile, () => { step.value = 0 })

async function startTour(mode) {
  tourMode.value = mode
  step.value = 0
  takeSnapshot()
  const s = currentStep.value
  if (s?.panel !== undefined || s?.tab !== undefined) {
    emit('activate', { panel: s.panel ?? null, tab: s.tab ?? null })
    await nextTick()
  }
  update()
}

// ── Spotlight positioning ─────────────────────────────────────────────────────

const spotlight = ref(null)
const modalPos  = ref(null)

const PADDING = 8
const MODAL_W = 460
const MODAL_H = 300
const MARGIN  = 16

function waitForFrame() {
  return new Promise(r => requestAnimationFrame(r))
}

async function getRect(selector) {
  if (!selector) return null
  const el = document.querySelector(selector)
  if (!el) return null
  el.scrollIntoView({ block: 'center', inline: 'nearest' })
  await waitForFrame()
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

async function update() {
  const rect = await getRect(currentStep.value?.selector)
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
  [() => props.variantCount, () => props.selectedId, () => props.selectedNodeType,
   () => props.activeTab, () => props.currentVariantLinked, () => props.ratingCount],
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
  // drag cleanup (belt-and-suspenders)
  document.removeEventListener('mousemove', onDocMouseMove)
  document.removeEventListener('mouseup',   onDocMouseUp)
  document.removeEventListener('touchmove', onDocTouchMove)
  document.removeEventListener('touchend',  onDocTouchEnd)
})

// ── Drag ─────────────────────────────────────────────────────────────────────

const dragPos   = ref(null)   // { top, left } in px – set when user has dragged
const dragStart = ref(null)   // { mouseX, mouseY, modalTop, modalLeft }

function startDrag(clientX, clientY, modalEl) {
  const rect = modalEl.getBoundingClientRect()
  dragStart.value = { clientX, clientY, modalTop: rect.top, modalLeft: rect.left }
}

function moveDrag(clientX, clientY) {
  if (!dragStart.value) return
  const dx = clientX - dragStart.value.clientX
  const dy = clientY - dragStart.value.clientY
  dragPos.value = {
    top:  `${dragStart.value.modalTop  + dy}px`,
    left: `${dragStart.value.modalLeft + dx}px`,
  }
}

function endDrag() { dragStart.value = null }

function onHandleMouseDown(e) {
  if (e.button !== 0) return
  e.preventDefault()
  startDrag(e.clientX, e.clientY, e.currentTarget.closest('.onboarding-modal'))
  document.addEventListener('mousemove', onDocMouseMove)
  document.addEventListener('mouseup',   onDocMouseUp)
}

function onDocMouseMove(e) { moveDrag(e.clientX, e.clientY) }
function onDocMouseUp()    { endDrag(); document.removeEventListener('mousemove', onDocMouseMove); document.removeEventListener('mouseup', onDocMouseUp) }

function onHandleTouchStart(e) {
  const t = e.touches[0]
  startDrag(t.clientX, t.clientY, e.currentTarget.closest('.onboarding-modal'))
  document.addEventListener('touchmove', onDocTouchMove, { passive: false })
  document.addEventListener('touchend',  onDocTouchEnd)
}

function onDocTouchMove(e) { e.preventDefault(); const t = e.touches[0]; moveDrag(t.clientX, t.clientY) }
function onDocTouchEnd()   { endDrag(); document.removeEventListener('touchmove', onDocTouchMove); document.removeEventListener('touchend', onDocTouchEnd) }

// Reset drag position when step changes so modal re-positions to spotlight
watch(step, () => { dragPos.value = null })

// ── Computed styles ───────────────────────────────────────────────────────────

const spotlightStyle = computed(() => {
  if (!spotlight.value) return null
  const { top, left, width, height } = spotlight.value
  return { top: `${top}px`, left: `${left}px`, width: `${width}px`, height: `${height}px` }
})

const modalStyle = computed(() => {
  const pos = dragPos.value ?? modalPos.value
  if (!pos) return {}
  return { position: 'fixed', top: pos.top, left: pos.left, transform: 'none' }
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

      <!-- Drag handle (hidden on choice screen) -->
      <div
        v-if="tourMode !== null"
        class="onboarding-drag-handle"
        @mousedown="onHandleMouseDown"
        @touchstart.passive="onHandleTouchStart"
        title="Verschieben"
      >⠿</div>

      <button class="onboarding-close" @click="close" title="Schließen">✕</button>

      <!-- ── Choice screen ───────────────────────────────────────────── -->
      <template v-if="tourMode === null">
        <div class="onboarding-body" style="margin-bottom:4px">
          <div class="onboarding-icon">🗺️</div>
          <h3 class="onboarding-title">Willkommen beim QBuilder!</h3>
          <p class="onboarding-text" style="min-height:0;margin-bottom:8px">
            Wie viel Zeit hast du gerade?
          </p>
        </div>
        <div class="onboarding-choice">
          <button class="onboarding-choice-btn" @click="startTour('full')">
            <span class="choice-icon">📋</span>
            <span class="choice-label">Vollständige Tour</span>
            <span class="choice-meta">~10 Min. · Alle Funktionen Schritt für Schritt</span>
          </button>
          <button class="onboarding-choice-btn" @click="startTour('quick')">
            <span class="choice-icon">⚡</span>
            <span class="choice-label">Kurzübersicht</span>
            <span class="choice-meta">~2 Min. · Variante, Baum, Editor, Vorschau</span>
          </button>
        </div>
        <p class="onboarding-restart-note">
          Die Tour kann jederzeit über das Menü neu gestartet werden.
        </p>
      </template>

      <!-- ── Tour content ────────────────────────────────────────────── -->
      <template v-else>
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
        <div v-if="isInteractive" class="onboarding-hint-area">
          <div v-if="validationWarning" class="onboarding-warning" data-testid="tour-warning">
            <span>⚠</span> {{ validationWarning }}
          </div>
          <div data-testid="tour-hint" class="onboarding-hint">
            <span class="onboarding-hint-pulse">●</span>
            {{ currentStep.hint }}
          </div>
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
      </template>

    </div>
  </div>
</template>
