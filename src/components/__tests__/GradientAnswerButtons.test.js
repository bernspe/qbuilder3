import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import GradientAnswerButtons from '../GradientAnswerButtons.vue'

const restrictionOptions = ['Keine Probleme', 'Wenige Probleme', 'Einige Probleme', 'Starke Probleme', 'Sehr starke Probleme']
const yesnoOptions = ['Ja', 'Nein']
const envOptions = Array.from({ length: 9 }, (_, i) => `Option ${i + 1}`)

describe('GradientAnswerButtons – rendering', () => {
  it('renders correct number of buttons', () => {
    const wrapper = mount(GradientAnswerButtons, {
      props: { options: restrictionOptions, defaultIdx: null, colorScheme: 'restriction', order: 'schlecht-gut' }
    })
    expect(wrapper.findAll('.answer-btn')).toHaveLength(5)
  })

  it('shows option text in each button', () => {
    const wrapper = mount(GradientAnswerButtons, {
      props: { options: restrictionOptions, defaultIdx: null, colorScheme: 'restriction', order: 'schlecht-gut' }
    })
    const buttons = wrapper.findAll('.answer-btn')
    expect(buttons[0].text()).toBe('Keine Probleme')
    expect(buttons[4].text()).toBe('Sehr starke Probleme')
  })

  it('renders yesno options', () => {
    const wrapper = mount(GradientAnswerButtons, {
      props: { options: yesnoOptions, defaultIdx: null, colorScheme: 'yesno', order: 'schlecht-gut' }
    })
    expect(wrapper.findAll('.answer-btn')).toHaveLength(2)
    expect(wrapper.findAll('.answer-btn')[0].text()).toBe('Ja')
    expect(wrapper.findAll('.answer-btn')[1].text()).toBe('Nein')
  })

  it('renders 9 buttons for environment scheme', () => {
    const wrapper = mount(GradientAnswerButtons, {
      props: { options: envOptions, defaultIdx: null, colorScheme: 'environment', order: 'schlecht-gut' }
    })
    expect(wrapper.findAll('.answer-btn')).toHaveLength(9)
  })

  it('renders empty list for no options', () => {
    const wrapper = mount(GradientAnswerButtons, {
      props: { options: [], defaultIdx: null, colorScheme: 'restriction', order: 'schlecht-gut' }
    })
    expect(wrapper.findAll('.answer-btn')).toHaveLength(0)
  })
})

describe('GradientAnswerButtons – defaultIdx selection', () => {
  it('marks the button at defaultIdx as selected', () => {
    const wrapper = mount(GradientAnswerButtons, {
      props: { options: restrictionOptions, defaultIdx: 2, colorScheme: 'restriction', order: 'schlecht-gut' }
    })
    const buttons = wrapper.findAll('.answer-btn')
    expect(buttons[2].classes()).toContain('selected')
  })

  it('does not mark other buttons as selected', () => {
    const wrapper = mount(GradientAnswerButtons, {
      props: { options: restrictionOptions, defaultIdx: 2, colorScheme: 'restriction', order: 'schlecht-gut' }
    })
    const buttons = wrapper.findAll('.answer-btn')
    expect(buttons[0].classes()).not.toContain('selected')
    expect(buttons[1].classes()).not.toContain('selected')
    expect(buttons[3].classes()).not.toContain('selected')
  })

  it('marks no button as selected when defaultIdx is null', () => {
    const wrapper = mount(GradientAnswerButtons, {
      props: { options: restrictionOptions, defaultIdx: null, colorScheme: 'restriction', order: 'schlecht-gut' }
    })
    const buttons = wrapper.findAll('.answer-btn')
    buttons.forEach(btn => expect(btn.classes()).not.toContain('selected'))
  })
})

describe('GradientAnswerButtons – colors', () => {
  it('all buttons have a background-color style', () => {
    const wrapper = mount(GradientAnswerButtons, {
      props: { options: restrictionOptions, defaultIdx: null, colorScheme: 'restriction', order: 'schlecht-gut' }
    })
    wrapper.findAll('.answer-btn').forEach(btn => {
      expect(btn.attributes('style')).toContain('background-color')
    })
  })

  it('restriction scheme: first button is reddish (hue near 0)', () => {
    const wrapper = mount(GradientAnswerButtons, {
      props: { options: restrictionOptions, defaultIdx: null, colorScheme: 'restriction', order: 'schlecht-gut' }
    })
    const firstStyle = wrapper.findAll('.answer-btn')[0].attributes('style')
    // hsl(0, ...) or similar red hue
    expect(firstStyle).toMatch(/hsl\(0[^,]*,/)
  })

  it('restriction scheme: last button is greenish (hue near 120)', () => {
    const wrapper = mount(GradientAnswerButtons, {
      props: { options: restrictionOptions, defaultIdx: null, colorScheme: 'restriction', order: 'schlecht-gut' }
    })
    const lastStyle = wrapper.findAll('.answer-btn')[4].attributes('style')
    expect(lastStyle).toMatch(/hsl\(120[^,]*,/)
  })

  it('yesno scheme: first button (Ja) is greenish', () => {
    const wrapper = mount(GradientAnswerButtons, {
      props: { options: yesnoOptions, defaultIdx: null, colorScheme: 'yesno', order: 'schlecht-gut' }
    })
    const jaStyle = wrapper.findAll('.answer-btn')[0].attributes('style')
    expect(jaStyle).toMatch(/hsl\(120[^,]*,/)
  })

  it('yesno scheme: second button (Nein) is reddish', () => {
    const wrapper = mount(GradientAnswerButtons, {
      props: { options: yesnoOptions, defaultIdx: null, colorScheme: 'yesno', order: 'schlecht-gut' }
    })
    const neinStyle = wrapper.findAll('.answer-btn')[1].attributes('style')
    expect(neinStyle).toMatch(/hsl\(0[^,]*,/)
  })

  it('gut-schlecht order reverses colors vs schlecht-gut', () => {
    const wrapperSG = mount(GradientAnswerButtons, {
      props: { options: restrictionOptions, defaultIdx: null, colorScheme: 'restriction', order: 'schlecht-gut' }
    })
    const wrapperGS = mount(GradientAnswerButtons, {
      props: { options: restrictionOptions, defaultIdx: null, colorScheme: 'restriction', order: 'gut-schlecht' }
    })
    const firstSG = wrapperSG.findAll('.answer-btn')[0].attributes('style')
    const firstGS = wrapperGS.findAll('.answer-btn')[0].attributes('style')
    expect(firstSG).not.toBe(firstGS)
  })

  // ICF b/d/s uses gut-schlecht: "Keine Probleme" (index 0) = grün, "Sehr starke Probleme" = rot
  it('ICF b/d/s (gut-schlecht): first button "Keine Probleme" is greenish', () => {
    const wrapper = mount(GradientAnswerButtons, {
      props: { options: restrictionOptions, defaultIdx: null, colorScheme: 'restriction', order: 'gut-schlecht' }
    })
    const firstStyle = wrapper.findAll('.answer-btn')[0].attributes('style')
    expect(firstStyle).toMatch(/hsl\(120[^,]*,/)
  })

  it('ICF b/d/s (gut-schlecht): last button "Sehr starke Probleme" is reddish', () => {
    const wrapper = mount(GradientAnswerButtons, {
      props: { options: restrictionOptions, defaultIdx: null, colorScheme: 'restriction', order: 'gut-schlecht' }
    })
    const lastStyle = wrapper.findAll('.answer-btn')[4].attributes('style')
    expect(lastStyle).toMatch(/hsl\(0[^,]*,/)
  })
})
