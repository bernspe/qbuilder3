import icfData from '../assets/icf_codes_mit_fragen.json'

const ICF_ANSWERS_BDS = [
  'Keine Probleme',
  'Wenige Probleme',
  'Einige Probleme',
  'Starke Probleme',
  'Sehr starke Probleme oder gar nicht möglich'
]

const ICF_ANSWERS_E = [
  'Dadurch vollständig beeinträchtigt',
  'Dadurch stark beeinträchtigt',
  'Dadurch mäßig beeinträchtigt',
  'Dadurch leicht beeinträchtigt',
  'Dadurch gar nicht beeinträchtigt',
  'Unterstützt ein wenig',
  'Unterstützt mäßig',
  'Unterstützt substantiell',
  'Beeinflussen mein Leben sehr stark postitiv'
]

export function lookupIcf(code) {
  if (!code) return null
  return icfData[code.toLowerCase()] ?? null
}

export function getIcfAnswers(code) {
  return code?.toLowerCase().startsWith('e') ? ICF_ANSWERS_E : ICF_ANSWERS_BDS
}

export function getIcfIconPath(code) {
  return `${import.meta.env.VITE_IMAGESERVER}/icf-pics/${code}.jpg`
}
