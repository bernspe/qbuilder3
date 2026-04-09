import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import OnboardingModal from '../OnboardingModal.vue'

// Prevent getBoundingClientRect from throwing in JSDOM
beforeEach(() => {
  vi.useFakeTimers()
  Element.prototype.getBoundingClientRect = vi.fn(() => ({
    top: 100, left: 100, width: 200, height: 50, bottom: 150, right: 300
  }))
  window.innerWidth  = 1024
  window.innerHeight = 768
})

afterEach(() => {
  vi.useRealTimers()
})

function defaultProps(overrides = {}) {
  return {
    variantCount:         1,
    selectedId:           null,
    selectedNodeType:     null,
    activeTab:            'editor',
    currentVariantLinked: false,
    ratingCount:          0,
    initialMode:          'full', // bypass choice screen in tests
    ...overrides,
  }
}

// Advance through watcher + timer + re-render
async function triggerAdvance(wrapper, propUpdate) {
  await wrapper.setProps(propUpdate)
  await flushPromises()
  vi.advanceTimersByTime(700)   // > 600ms debounce
  await flushPromises()
}

// ── Interaktive Schritte – auto-advance ───────────────────────────────────────

describe('Interaktive Schritte – auto-advance', () => {
  it('Step 2 (Variante anlegen): advance wenn variantCount zunimmt', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 2 })
    })
    await flushPromises()
    expect(wrapper.find('.onboarding-title').text()).toBe('Variante anlegen')

    await triggerAdvance(wrapper, { variantCount: 2 })

    expect(wrapper.find('.onboarding-title').text()).not.toBe('Variante anlegen')
  })

  it('Step 2: KEIN advance wenn variantCount gleich bleibt', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 2 })
    })
    await flushPromises()

    await triggerAdvance(wrapper, { variantCount: 1 }) // same value

    expect(wrapper.find('.onboarding-title').text()).toBe('Variante anlegen')
  })

  it('Step 3 (Speichern): advance wenn currentVariantLinked true wird', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 3 })
    })
    await flushPromises()
    expect(wrapper.find('.onboarding-title').text()).toBe('Auf dem Server speichern')

    await triggerAdvance(wrapper, { currentVariantLinked: true })

    expect(wrapper.find('.onboarding-title').text()).not.toBe('Auf dem Server speichern')
  })

  it('Step 4 (Screeningfrage auswählen): advance wenn selectedNodeType question wird', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 4 })
    })
    await flushPromises()
    expect(wrapper.find('.onboarding-title').text()).toBe('Screeningfrage auswählen')

    await triggerAdvance(wrapper, { selectedId: 'n1_abc', selectedNodeType: 'question' })

    expect(wrapper.find('.onboarding-title').text()).not.toBe('Screeningfrage auswählen')
  })

  it('Step 4: KEIN advance wenn falscher Typ selektiert wird', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 4 })
    })
    await flushPromises()

    await triggerAdvance(wrapper, { selectedId: 'n1_abc', selectedNodeType: 'section' })

    expect(wrapper.find('.onboarding-title').text()).toBe('Screeningfrage auswählen')
  })

  it('Step 4: Warnung sichtbar wenn falscher Typ selektiert', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 4, selectedId: 'n1_abc', selectedNodeType: 'section' })
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="tour-warning"]').exists()).toBe(true)
  })

  it('Step 17 (ICF): KEIN advance wenn falscher Typ selektiert wird', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 17 })
    })
    await flushPromises()

    await triggerAdvance(wrapper, { selectedId: 'n1_abc', selectedNodeType: 'question' })

    expect(wrapper.find('.onboarding-title').text()).toBe('ICF-Item auswählen')
  })

  it('Step 17: Warnung sichtbar wenn falscher Typ selektiert', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 17, selectedId: 'n1_abc', selectedNodeType: 'question' })
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="tour-warning"]').exists()).toBe(true)
  })

  it('Step 11 (Unterfrage): advance wenn selectedNodeType subquestion wird', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 11 })
    })
    await flushPromises()
    expect(wrapper.find('.onboarding-title').text()).toBe('Unterfrage hinzufügen')

    await triggerAdvance(wrapper, { selectedNodeType: 'subquestion' })

    expect(wrapper.find('.onboarding-title').text()).not.toBe('Unterfrage hinzufügen')
  })

  it('Step 17 (ICF auswählen): advance wenn selectedNodeType icf wird', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 17 })
    })
    await flushPromises()
    expect(wrapper.find('.onboarding-title').text()).toBe('ICF-Item auswählen')

    await triggerAdvance(wrapper, { selectedNodeType: 'icf' })

    expect(wrapper.find('.onboarding-title').text()).not.toBe('ICF-Item auswählen')
  })

  it('Step 21 (Vorschau Tab): advance wenn activeTab preview wird', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 21 })
    })
    await flushPromises()
    expect(wrapper.find('.onboarding-title').text()).toBe('Vorschau-Tab öffnen')

    await triggerAdvance(wrapper, { activeTab: 'preview' })

    expect(wrapper.find('.onboarding-title').text()).not.toBe('Vorschau-Tab öffnen')
  })

  it('Step 22 (Rating): advance wenn ratingCount zunimmt', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 22 })
    })
    await flushPromises()
    expect(wrapper.find('.onboarding-title').text()).toBe('Items bewerten')

    await triggerAdvance(wrapper, { ratingCount: 1 })

    expect(wrapper.find('.onboarding-title').text()).not.toBe('Items bewerten')
  })

  it('Step 22: KEIN advance wenn ratingCount gleich bleibt', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 22 })
    })
    await flushPromises()

    await triggerAdvance(wrapper, { ratingCount: 0 })

    expect(wrapper.find('.onboarding-title').text()).toBe('Items bewerten')
  })
})

// ── Overlay-Verhalten ──────────────────────────────────────────────────────────

describe('Overlay-Verhalten', () => {
  it('Interaktiver Schritt: tour-overlay--interactive vorhanden', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 2 }) // Variante anlegen = interactive
    })
    await flushPromises()
    expect(wrapper.find('.tour-overlay').classes()).toContain('tour-overlay--interactive')
  })

  it('Info-Schritt: tour-overlay--interactive nicht vorhanden', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 0 }) // Das Original = info
    })
    await flushPromises()
    expect(wrapper.find('.tour-overlay').classes()).not.toContain('tour-overlay--interactive')
  })

  it('Geführter Schritt: tour-overlay--interactive vorhanden (damit Klicks durchgehen)', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 6 }) // Icon = guided
    })
    await flushPromises()
    expect(wrapper.find('.tour-overlay').classes()).toContain('tour-overlay--interactive')
  })
})

// ── Button-Sichtbarkeit ───────────────────────────────────────────────────────

describe('Button-Sichtbarkeit', () => {
  it('Info-Schritt: Weiter-Button vorhanden', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 0 })
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="weiter-btn"]').exists()).toBe(true)
  })

  it('Guided-Schritt: Weiter-Button vorhanden', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 6 }) // Icon = guided
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="weiter-btn"]').exists()).toBe(true)
  })

  it('Interaktiver Schritt: kein Weiter-Button', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 2 }) // Variante anlegen = interactive
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="weiter-btn"]').exists()).toBe(false)
  })

  it('Interaktiver Schritt: Hint-Text vorhanden', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 2 })
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="tour-hint"]').exists()).toBe(true)
  })

  it('Letzter Schritt (26): Starten-Button statt Weiter', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 26 })
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="finish-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="weiter-btn"]').exists()).toBe(false)
  })
})

// ── emit activate ──────────────────────────────────────────────────────────────

describe('emit activate', () => {
  it('Mobile Step mit panel emittiert activate({ panel, tab })', async () => {
    // Set mobile viewport
    window.innerWidth = 400
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 2 }) // Variante anlegen, panel: variants on mobile
    })
    await flushPromises()
    const activates = wrapper.emitted('activate') ?? []
    expect(activates.length).toBeGreaterThan(0)
    const lastActivate = activates[activates.length - 1][0]
    expect(lastActivate.panel).toBe('variants')
  })

  it('Desktop Info-Schritt ohne panel/tab: kein activate-emit', async () => {
    window.innerWidth = 1024
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 0 }) // Das Original, no panel on desktop
    })
    await flushPromises()
    const activates = wrapper.emitted('activate') ?? []
    // Desktop step 0 has no panel/tab, so activate should not be emitted
    expect(activates.every(([p]) => p.panel === null && p.tab === null)).toBe(true)
  })
})
