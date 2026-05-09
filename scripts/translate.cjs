const fs = require('fs')
const path = require('path')

const DEEPL_API_KEY = 'c6530145-8f2d-4e89-9ece-5905b695fdfd:fx'
const DEEPL_URL = 'https://api-free.deepl.com/v2/translate'

const SKIP_KEYS = [
  'teesheet.flight',
  'teesheet.holes9',
  'teesheet.printFooter.siteUrl',
  'scorecards.validateConfirm',
  'results.leaderboard',
  'results.scorecards',
  'results.print',
  'payments.statuses.PAID',
  'payments.statuses.PENDING',
  'payments.statuses.EXEMPT',
  'payments.buttons.PAID',
  'payments.buttons.PENDING',
  'payments.buttons.EXEMPT',
  'scorecards.validate',
  'scorecards.newClub',
  'scorecards.newCourse',
  'myEvents.empty.subtitle',
  'communications.templates.yesButtonDesc',
  'clubs.title',
  'editEvent.feeHint',
  'flights.generateHint',
  'scorecards.clubCourse',
]

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function translate(text, targetLang) {
  if (!text || text.trim() === '' || text === '—') return text
  await sleep(300)
  const res = await fetch(DEEPL_URL, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [text],
      source_lang: 'EN',
      target_lang: targetLang,
      tag_handling: 'xml',
      ignore_tags: ['ignore'],
    }),
  })
  if (!res.ok) throw new Error(`DeepL error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.translations[0].text
}

function findMissingKeys(source, target, prefix = '') {
  const missing = {}
  for (const [key, value] of Object.entries(source)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && !Array.isArray(value)) {
      const nested = findMissingKeys(value, target[key] ?? {}, fullKey)
      if (Object.keys(nested).length > 0) missing[key] = nested
    } else if (!(key in (target ?? {}))) {
      missing[key] = value
    }
  }
  return missing
}

async function translateObject(obj, targetLang, prefix = '') {
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (SKIP_KEYS.includes(fullKey)) {
      result[key] = value
      continue
    }
    if (typeof value === 'string') {
      const protected_text = value.replace(/\{(\w+)\}/g, '<ignore>{$1}</ignore>')
      const translated = await translate(protected_text, targetLang)
      result[key] = translated.replace(/<ignore>\{(\w+)\}<\/ignore>/g, '{$1}')
      console.log(`  ${fullKey}: "${value}" → "${result[key]}"`)
    } else if (Array.isArray(value)) {
      const results = []
      for (const item of value) results.push(await translate(item, targetLang))
      result[key] = results
    } else if (typeof value === 'object' && value !== null) {
      result[key] = await translateObject(value, targetLang, fullKey)
    } else {
      result[key] = value
    }
  }
  return result
}

function deepMerge(base, additions) {
  const result = { ...base }
  for (const [key, value] of Object.entries(additions)) {
    if (typeof value === 'object' && !Array.isArray(value) && key in base) {
      result[key] = deepMerge(base[key], value)
    } else {
      result[key] = value
    }
  }
  return result
}

async function main() {
  const enJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/messages/en.json'), 'utf-8'))

  const targets = [
    { lang: 'FR', file: 'fr.json' },
    { lang: 'ES', file: 'es.json' },
    { lang: 'DE', file: 'de.json' },
    { lang: 'NL', file: 'nl.json' },
  ]

  for (const { lang, file } of targets) {
    const filePath = path.join(__dirname, `../src/messages/${file}`)
    const existing = fs.existsSync(filePath)
      ? JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      : {}

    const missing = findMissingKeys(enJson, existing)

    if (Object.keys(missing).length === 0) {
      console.log(`\n✅ ${file} — déjà à jour`)
      continue
    }

    console.log(`\n🌍 Traduction vers ${lang} (${Object.keys(missing).length} sections manquantes)...`)

    try {
      const translated = await translateObject(missing, lang)
      const merged = deepMerge(existing, translated)
      fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf-8')
      console.log(`✅ ${file} mis à jour !`)
    } catch (e) {
      console.error(`❌ Erreur pour ${lang}:`, e.message)
    }
  }
}

main()