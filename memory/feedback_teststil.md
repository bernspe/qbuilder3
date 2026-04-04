---
name: Test-Stil und Workflow
description: TDD-Workflow, Teststruktur für App.vue, DOM-Methoden mocken
type: feedback
---

Workflow: erst Plan → failing Tests → Implementierung bis alle Tests grün.

**Why:** Nutzer möchte test-driven vorgehen.

**How to apply:** Immer in dieser Reihenfolge arbeiten. Tests zuerst schreiben (sie müssen scheitern), dann implementieren.

## App.vue Tests
- `shallowMount` (nicht `mount`) verwenden wegen VueDraggable und Child-Components
- VueDraggable immer mocken: `vi.mock('vue-draggable-plus', () => ({ VueDraggable: { props: [...], template: '<div><slot /></div>' } }))`
- localStorage und prompt in beforeEach stubben

## DOM-Methoden (setSelectionRange etc.)
- NICHT auf textarea.element direkt setzen (zu späte Zuweisung, Watcher feuert vorher)
- Stattdessen: `vi.spyOn(HTMLTextAreaElement.prototype, 'setSelectionRange').mockImplementation(() => {})`
- Spy VOR dem Mount oder vor dem triggernden Event setzen

## v-model vs :value bei Textareas
- Für editierbare Textareas immer v-model verwenden (nicht :value + @input mit e.target.value)
- Mit :value resettet Vue nach Re-render den DOM-Wert → e.target.value liefert alten Wert
- Mit v-model: Ref wird sofort aktualisiert, Handler nutzt jsonEditContent.value
