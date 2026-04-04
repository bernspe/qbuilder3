import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import IconDisplay from '../IconDisplay.vue'

describe('IconDisplay – icf: prefix', () => {
  it('renders an img element', () => {
    const wrapper = mount(IconDisplay, { props: { icon: 'icf:d415' } })
    expect(wrapper.find('img').exists()).toBe(true)
  })

  it('img src contains the code and .jpg', () => {
    const wrapper = mount(IconDisplay, { props: { icon: 'icf:d415' } })
    const src = wrapper.find('img').attributes('src')
    expect(src).toContain('d415')
    expect(src).toContain('.jpg')
  })

  it('img src uses VITE_IMAGESERVER', () => {
    const wrapper = mount(IconDisplay, { props: { icon: 'icf:d415' } })
    const src = wrapper.find('img').attributes('src')
    expect(src).toContain('https://example.com/imageserver')
  })
})

describe('IconDisplay – direct paste from iconify (prefix:name)', () => {
  it('renders an img for twemoji:man-standing', () => {
    const wrapper = mount(IconDisplay, { props: { icon: 'twemoji:man-standing' } })
    expect(wrapper.find('img').exists()).toBe(true)
  })

  it('src contains iconify.design for twemoji:man-standing', () => {
    const wrapper = mount(IconDisplay, { props: { icon: 'twemoji:man-standing' } })
    expect(wrapper.find('img').attributes('src')).toContain('iconify.design')
  })

  it('src resolves twemoji:man-standing correctly', () => {
    const wrapper = mount(IconDisplay, { props: { icon: 'twemoji:man-standing' } })
    expect(wrapper.find('img').attributes('src')).toContain('twemoji/man-standing.svg')
  })

  it('handles icons with dashes in name: openmoji:man-standing-medium-skin-tone', () => {
    const wrapper = mount(IconDisplay, { props: { icon: 'openmoji:man-standing-medium-skin-tone' } })
    const src = wrapper.find('img').attributes('src')
    expect(src).toContain('openmoji/man-standing-medium-skin-tone.svg')
  })

  it('handles mdi:home format', () => {
    const wrapper = mount(IconDisplay, { props: { icon: 'mdi:home' } })
    const src = wrapper.find('img').attributes('src')
    expect(src).toContain('mdi/home.svg')
  })
})

describe('IconDisplay – legacy iconify: prefix (backwards compat)', () => {
  it('renders an img for iconify:mdi-home', () => {
    const wrapper = mount(IconDisplay, { props: { icon: 'iconify:mdi-home' } })
    expect(wrapper.find('img').exists()).toBe(true)
  })

  it('resolves iconify:mdi-home via legacy dash-split', () => {
    const wrapper = mount(IconDisplay, { props: { icon: 'iconify:mdi-home' } })
    const src = wrapper.find('img').attributes('src')
    expect(src).toContain('mdi/home.svg')
  })

  it('resolves iconify:mdi-arrow-left correctly', () => {
    const wrapper = mount(IconDisplay, { props: { icon: 'iconify:mdi-arrow-left' } })
    const src = wrapper.find('img').attributes('src')
    expect(src).toContain('arrow-left')
  })
})

describe('IconDisplay – svg: prefix', () => {
  it('renders a span with the SVG content', () => {
    const wrapper = mount(IconDisplay, { props: { icon: 'svg:<svg><circle r="10"/></svg>' } })
    expect(wrapper.html()).toContain('<circle')
  })

  it('does not render an img', () => {
    const wrapper = mount(IconDisplay, { props: { icon: 'svg:<svg></svg>' } })
    expect(wrapper.find('img').exists()).toBe(false)
  })
})

describe('IconDisplay – empty icon', () => {
  it('renders nothing visible for empty string', () => {
    const wrapper = mount(IconDisplay, { props: { icon: '' } })
    expect(wrapper.find('img').exists()).toBe(false)
    // The outer span.icon-display exists but has no children
    expect(wrapper.text()).toBe('')
  })
})

describe('IconDisplay – size prop', () => {
  it('applies size to the container', () => {
    const wrapper = mount(IconDisplay, { props: { icon: 'icf:d415', size: 48 } })
    const style = wrapper.find('.icon-display').attributes('style')
    expect(style).toContain('48px')
  })
})
