import { describe, it, expect } from 'vitest'
import { lookupIcf, getIcfAnswers, getIcfIconPath } from '../useIcfData.js'

describe('lookupIcf', () => {
  it('returns name and description for a known code', () => {
    const result = lookupIcf('d415')
    expect(result).not.toBeNull()
    expect(typeof result.name).toBe('string')
    expect(result.name.length).toBeGreaterThan(0)
    expect(typeof result.description).toBe('string')
  })

  it('returns a fragen array for a known code', () => {
    const result = lookupIcf('d415')
    expect(Array.isArray(result.fragen)).toBe(true)
    expect(result.fragen.length).toBeGreaterThan(0)
  })

  it('returns null for an unknown code', () => {
    expect(lookupIcf('xyz999')).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(lookupIcf('D415')).toEqual(lookupIcf('d415'))
  })

  it('handles null/undefined gracefully', () => {
    expect(lookupIcf(null)).toBeNull()
    expect(lookupIcf(undefined)).toBeNull()
    expect(lookupIcf('')).toBeNull()
  })
})

describe('getIcfAnswers', () => {
  it('returns 5-item array for d-chapter codes', () => {
    expect(getIcfAnswers('d415')).toHaveLength(5)
  })

  it('returns 5-item array for b-chapter codes', () => {
    expect(getIcfAnswers('b140')).toHaveLength(5)
  })

  it('returns 5-item array for s-chapter codes', () => {
    expect(getIcfAnswers('s720')).toHaveLength(5)
  })

  it('first b/d/s answer is "Keine Probleme"', () => {
    expect(getIcfAnswers('d415')[0]).toBe('Keine Probleme')
  })

  it('last b/d/s answer contains "Sehr starke Probleme"', () => {
    expect(getIcfAnswers('d415')[4]).toContain('Sehr starke Probleme')
  })

  it('returns 9-item array for e-chapter codes', () => {
    expect(getIcfAnswers('e310')).toHaveLength(9)
  })

  it('first e answer is "Dadurch vollständig beeinträchtigt"', () => {
    expect(getIcfAnswers('e310')[0]).toBe('Dadurch vollständig beeinträchtigt')
  })

  it('last e answer contains "postitiv" (as in spec)', () => {
    const answers = getIcfAnswers('e310')
    expect(answers[answers.length - 1].toLowerCase()).toContain('postitiv')
  })

  it('is case-insensitive for chapter detection', () => {
    expect(getIcfAnswers('E310')).toHaveLength(9)
    expect(getIcfAnswers('D415')).toHaveLength(5)
  })
})

describe('getIcfIconPath', () => {
  it('returns a URL containing the code and .jpg', () => {
    const url = getIcfIconPath('d415')
    expect(url).toContain('d415')
    expect(url).toContain('.jpg')
  })

  it('uses the VITE_IMAGESERVER env variable', () => {
    const url = getIcfIconPath('d415')
    expect(url).toContain('https://example.com/imageserver')
  })

  it('places the code under /icf-pics/', () => {
    const url = getIcfIconPath('d415')
    expect(url).toContain('/icf-pics/d415.jpg')
  })
})
