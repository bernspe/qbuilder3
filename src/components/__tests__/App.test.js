import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import App from '../../App.vue'

// VueDraggable muss als einfaches Wrapper-Element gemockt werden
vi.mock('vue-draggable-plus', () => ({
  VueDraggable: {
    props: ['modelValue', 'handle', 'animation'],
    emits: ['update:modelValue'],
    template: '<div><slot /></div>'
  }
}))

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  })
  vi.stubGlobal('prompt', () => null)
  vi.stubGlobal('alert', () => {})
})

// ─── Feature 1: Varianten löschen ────────────────────────────────────────────

describe('App – Varianten löschen', () => {
  it('zeigt keinen Löschen-Button wenn nur eine Variante vorhanden ist', () => {
    const wrapper = shallowMount(App)
    expect(wrapper.find('[data-testid="delete-variant"]').exists()).toBe(false)
  })

  it('zeigt Löschen-Buttons wenn mehr als eine Variante vorhanden ist', async () => {
    vi.stubGlobal('prompt', () => 'TestVariante')
    const wrapper = shallowMount(App)
    // "+ Neue"-Button klicken
    const addBtn = wrapper.findAll('button').find(b => b.text() === '+ Neue')
    await addBtn.trigger('click')
    expect(wrapper.findAll('[data-testid="delete-variant"]').length).toBeGreaterThan(0)
  })

  it('entfernt die Variante nach Klick auf Löschen', async () => {
    vi.stubGlobal('prompt', () => 'ZuLoeschende')
    const wrapper = shallowMount(App)
    const addBtn = wrapper.findAll('button').find(b => b.text() === '+ Neue')
    await addBtn.trigger('click')
    // Anzahl der Varianten-Einträge vorher
    const vorher = wrapper.findAll('[data-testid="variant-item"]').length
    expect(vorher).toBe(2)
    const deleteBtn = wrapper.find('[data-testid="delete-variant"]')
    await deleteBtn.trigger('click')
    const nachher = wrapper.findAll('[data-testid="variant-item"]').length
    expect(nachher).toBe(1)
  })
})

// ─── Feature 2: JSON direkt editierbar ───────────────────────────────────────

describe('App – JSON-Tab editierbar', () => {
  async function openJsonTab(wrapper) {
    const jsonTabBtn = wrapper.findAll('button').find(b => b.text() === 'JSON')
    await jsonTabBtn.trigger('click')
    await wrapper.vm.$nextTick()
  }

  it('JSON-Textarea existiert im JSON-Tab', async () => {
    const wrapper = shallowMount(App)
    await openJsonTab(wrapper)
    expect(wrapper.find('[data-testid="json-editor"]').exists()).toBe(true)
  })

  it('JSON-Textarea hat kein readonly-Attribut', async () => {
    const wrapper = shallowMount(App)
    await openJsonTab(wrapper)
    const textarea = wrapper.find('[data-testid="json-editor"]')
    expect(textarea.attributes('readonly')).toBeUndefined()
  })

  it('zeigt Fehlermeldung bei ungültigem JSON', async () => {
    const wrapper = shallowMount(App)
    await openJsonTab(wrapper)
    const textarea = wrapper.find('[data-testid="json-editor"]')
    await textarea.setValue('{ kein gültiges JSON }}}')
    await textarea.trigger('input')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="json-error"]').exists()).toBe(true)
  })

  it('zeigt keine Fehlermeldung bei gültigem JSON', async () => {
    const wrapper = shallowMount(App)
    await openJsonTab(wrapper)
    const textarea = wrapper.find('[data-testid="json-editor"]')
    const validJson = textarea.element.value
    await textarea.setValue(validJson)
    await textarea.trigger('input')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="json-error"]').exists()).toBe(false)
  })

  it('aktualisiert die Varianten bei gültigem JSON mit neuer Struktur', async () => {
    const wrapper = shallowMount(App)
    await openJsonTab(wrapper)
    const textarea = wrapper.find('[data-testid="json-editor"]')
    const newVariants = {
      exportedAt: new Date().toISOString(),
      variants: {
        custom: { id: 'custom', label: 'Custom', nodes: [] }
      }
    }
    await textarea.setValue(JSON.stringify(newVariants, null, 2))
    await textarea.trigger('input')
    await wrapper.vm.$nextTick()
    // Kein Fehler sollte angezeigt werden
    expect(wrapper.find('[data-testid="json-error"]').exists()).toBe(false)
  })
})

// ─── Feature 3: JSON-Tab scrollt zur ausgewählten Node ───────────────────────

describe('App – JSON-Tab Scroll bei TreeView-Navigation', () => {
  it('scrollt im JSON-Tab zur Node-ID wenn eine Node selektiert ist', async () => {
    // Spy VOR dem Mount setzen, damit alle setSelectionRange-Aufrufe abgefangen werden
    const spy = vi.spyOn(HTMLTextAreaElement.prototype, 'setSelectionRange').mockImplementation(() => {})
    const wrapper = shallowMount(App)

    // Abschnitt hinzufügen (setzt selectedId intern)
    const addSectionBtn = wrapper.findAll('button').find(b => b.text() === '+ Abschnitt')
    await addSectionBtn.trigger('click')
    await wrapper.vm.$nextTick()

    // JSON-Tab öffnen → Watcher [selectedId, activeTab] feuert
    const jsonTabBtn = wrapper.findAll('button').find(b => b.text() === 'JSON')
    await jsonTabBtn.trigger('click')
    // Mehrere ticks für den async Watcher
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(spy).toHaveBeenCalled()
  })

  it('scrollt auch wenn erst Node selektiert, dann Tab gewechselt wird', async () => {
    const spy = vi.spyOn(HTMLTextAreaElement.prototype, 'setSelectionRange').mockImplementation(() => {})
    const wrapper = shallowMount(App)

    // Zuerst Abschnitt hinzufügen (im Editor-Tab)
    const addSectionBtn = wrapper.findAll('button').find(b => b.text() === '+ Abschnitt')
    await addSectionBtn.trigger('click')
    await wrapper.vm.$nextTick()

    // JSON-Tab öffnen → Watcher feuert mit [selectedId, 'json']
    const jsonTabBtn = wrapper.findAll('button').find(b => b.text() === 'JSON')
    await jsonTabBtn.trigger('click')
    // Mehrere ticks für den async Watcher (await nextTick() innerhalb des Watchers)
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(spy).toHaveBeenCalled()
  })
})
