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
    activeTab:            'editor',
    currentVariantLinked: false,
    ratingCount:          0,
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

  it('Step 4 (Frage auswählen): advance wenn selectedId gesetzt wird', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 4 })
    })
    await flushPromises()
    expect(wrapper.find('.onboarding-title').text()).toBe('Frage auswählen')

    await triggerAdvance(wrapper, { selectedId: 'n1_abc' })

    expect(wrapper.find('.onboarding-title').text()).not.toBe('Frage auswählen')
  })

  it('Step 11 (Vorschau Tab): advance wenn activeTab preview wird', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 11 })
    })
    await flushPromises()
    expect(wrapper.find('.onboarding-title').text()).toBe('Vorschau-Tab öffnen')

    await triggerAdvance(wrapper, { activeTab: 'preview' })

    expect(wrapper.find('.onboarding-title').text()).not.toBe('Vorschau-Tab öffnen')
  })

  it('Step 12 (Rating): advance wenn ratingCount zunimmt', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 12 })
    })
    await flushPromises()
    expect(wrapper.find('.onboarding-title').text()).toBe('Items bewerten')

    await triggerAdvance(wrapper, { ratingCount: 1 })

    expect(wrapper.find('.onboarding-title').text()).not.toBe('Items bewerten')
  })

  it('Step 12: KEIN advance wenn ratingCount gleich bleibt', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 12 })
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

  it('Letzter Schritt (15): Starten-Button statt Weiter', async () => {
    const wrapper = mount(OnboardingModal, {
      props: defaultProps({ initialStep: 15 })
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
