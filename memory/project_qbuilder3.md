---
name: qbuilder3 Projektübersicht
description: Vue 3 Fragebogen-Editor mit ICF, Varianten, Undo/Redo — Architektur und key patterns
type: project
---

Vue 3 (Composition API, script setup) Fragebogen-Editor.

**Why:** Klinische Fragebogen-Erstellung mit ICF-Mapping, Varianten-Workflow, Undo/Redo.

**How to apply:** Bei neuen Features: CLAUDE.md Rules beachten (Icons/Questions/ICF aus docs/ICONS_QUESTIONS_ICF.md), VueUse für Undo/Redo.

## Schlüsselarchitektur
- `useQuestionnaire.js` — Kern-State (reactive variants, CRUD für Nodes)
- `useIcfData.js` — ICF-Lookup und Antwort-Sets
- `App.vue` — Root, orchestriert Tabs (Editor/Vorschau/JSON), Undo/Redo via useRefHistory
- Undo/Redo: snapshot ref + useRefHistory(snapshot, {capacity:50}) + isUndoRedo-Flag
- JSON-Tab: v-model auf Textarea (nicht :value!), isApplyingJson-Flag gegen Feedback-Loop
- Varianten-Sync: watch(activeTab) + watch(jsonPreview) mit isApplyingJson-Guard

## Features (Stand 2026-04-04)
- Varianten löschen: deleteVariant() in useQuestionnaire, verhindert Löschen der letzten
- JSON direkt editierbar: v-model + handleJsonInput() + jsonParseError-Anzeige
- JSON-Tab scrollt zur selektierten Node: watch([selectedId, activeTab]) → setSelectionRange
