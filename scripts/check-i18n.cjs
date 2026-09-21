#!/usr/bin/env node
/*
 * Contrôle des traductions GolfGo — à lancer AVANT chaque déploiement :
 *
 *     npm run check:i18n
 *
 * Aucune dépendance. Code de sortie 0 = tout est bon ; 1 = au moins une ERREUR (à corriger avant de déployer).
 * Les AVERTISSEMENTS n'empêchent pas le déploiement : ce sont des points à regarder.
 *
 * ERREURS
 *   1. fichier JSON invalide, ou clé en double dans un même bloc (JSON.parse ne le signale pas !)
 *   2. clé absente d'une langue par rapport aux autres (parité des 5 fichiers)
 *   3. nom de clé fautif (espace, accent, tiret…) : seuls A-Z a-z 0-9 et _ sont autorisés
 *   4. valeur vide ou qui n'est pas un texte
 *   5. variables {nom} différentes d'une langue à l'autre (ex. {count} oublié dans une traduction)
 *   6. clé utilisée dans le code (t('a.b')) mais absente des fichiers de traduction
 *
 * AVERTISSEMENTS
 *   - texte anglais qui contient des accents français (mauvaise langue dans en.json)
 *   - texte identique à l'anglais dans une autre langue (peut-être non traduit)
 *   - espace (ou espace insécable) au début ou à la fin d'un texte
 *
 * Options :  --unused   liste aussi les clés jamais utilisées dans le code (indicatif : les clés construites
 *                       dynamiquement, comme t(`status.${x}`), apparaissent à tort comme « inutilisées »)
 *            --dir=CHEMIN   dossier des fichiers de langue (défaut : src/messages) — utile pour les tests
 *            --src=CHEMIN   dossier du code à analyser (défaut : src)
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const arg = (name, def) => { const a = process.argv.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=').slice(1).join('=') : def }
const MESSAGES_DIR = path.resolve(ROOT, arg('dir', 'src/messages'))
const SRC_DIR = path.resolve(ROOT, arg('src', 'src'))
const SHOW_UNUSED = process.argv.includes('--unused')
const LOCALES = ['fr', 'en', 'nl', 'de', 'es']
const REF = 'en'

const useColor = process.stdout.isTTY
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s)
const red = s => c('31', s), yellow = s => c('33', s), green = s => c('32', s), bold = s => c('1', s), dim = s => c('2', s)

const errors = []
const warnings = []
const err = (cat, msg) => errors.push({ cat, msg })
const warn = (cat, msg) => warnings.push({ cat, msg })

// ── Mini-lecteur JSON qui détecte les clés en double ───────────────────────────────────────────
function parseJsonStrict(text, file) {
  let i = 0
  const dups = []
  const ws = () => { while (i < text.length && /\s/.test(text[i])) i++ }
  const fail = m => { throw new Error(`${m} (position ${i})`) }
  function str() {
    if (text[i] !== '"') fail('guillemet attendu')
    let j = i + 1, out = ''
    while (j < text.length && text[j] !== '"') {
      if (text[j] === '\\') { out += text.slice(j, j + 2); j += 2 } else { out += text[j++] }
    }
    if (j >= text.length) fail('chaîne non terminée')
    i = j + 1
    return JSON.parse('"' + out + '"')
  }
  function value(pathArr) {
    ws()
    const ch = text[i]
    if (ch === '{') {
      i++; const obj = {}; const seen = new Set(); ws()
      if (text[i] === '}') { i++; return obj }
      for (;;) {
        ws(); const k = str(); ws()
        if (text[i] !== ':') fail('« : » attendu'); i++
        if (seen.has(k)) dups.push([...pathArr, k].join('.'))
        seen.add(k)
        obj[k] = value([...pathArr, k]); ws()
        if (text[i] === ',') { i++; continue }
        if (text[i] === '}') { i++; return obj }
        fail('« , » ou « } » attendu')
      }
    }
    if (ch === '[') {
      i++; const arr = []; ws()
      if (text[i] === ']') { i++; return arr }
      for (;;) {
        arr.push(value([...pathArr, String(arr.length)])); ws()
        if (text[i] === ',') { i++; continue }
        if (text[i] === ']') { i++; return arr }
        fail('« , » ou « ] » attendu')
      }
    }
    if (ch === '"') return str()
    const m = /^(true|false|null|-?\d+(\.\d+)?([eE][+-]?\d+)?)/.exec(text.slice(i))
    if (!m) fail('valeur inattendue')
    i += m[0].length
    return JSON.parse(m[0])
  }
  const result = value([])
  ws()
  if (i < text.length) fail('texte inattendu après la fin du JSON')
  return { data: result, dups }
}

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out)
    else if (Array.isArray(v)) v.forEach((x, idx) => { out[`${key}.${idx}`] = x })
    else out[key] = v
  }
  return out
}

// variables ICU de premier niveau : {name} ou {count, plural, …} → "name" / "count"  (les modèles {{x}} sont ignorés)
function placeholders(str) {
  if (typeof str !== 'string' || str.includes('{{')) return null
  const names = new Set()
  let depth = 0
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    if (ch === '{') {
      if (depth === 0) {
        const m = /^\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*[,}]/.exec(str.slice(i))
        if (m) names.add(m[1])
      }
      depth++
    } else if (ch === '}') depth = Math.max(0, depth - 1)
  }
  return names
}

// ── 1. Chargement + doublons ──────────────────────────────────────────────────────────────────
const msgs = {}
const flat = {}
for (const l of LOCALES) {
  const file = path.join(MESSAGES_DIR, `${l}.json`)
  if (!fs.existsSync(file)) { err('fichier', `${l}.json introuvable dans ${path.relative(ROOT, MESSAGES_DIR)}`); continue }
  try {
    const { data, dups } = parseJsonStrict(fs.readFileSync(file, 'utf8'), file)
    msgs[l] = data
    flat[l] = flatten(data)
    dups.forEach(d => err('doublon', `${l}.json : la clé « ${d} » apparaît deux fois dans le même bloc`))
  } catch (e) { err('JSON', `${l}.json invalide : ${e.message}`) }
}
const loaded = LOCALES.filter(l => flat[l])

// ── 2. Parité des clés ───────────────────────────────────────────────────────────────────────
if (loaded.length > 1) {
  const union = new Set(loaded.flatMap(l => Object.keys(flat[l])))
  for (const l of loaded) {
    const missing = [...union].filter(k => !(k in flat[l]))
    missing.slice(0, 40).forEach(k => err('clé manquante', `${l}.json : « ${k} » manque (présente dans ${loaded.filter(x => k in flat[x]).join(', ')})`))
    if (missing.length > 40) err('clé manquante', `${l}.json : … et ${missing.length - 40} autres clés manquantes`)
  }
}

// ── 3. Noms de clés, 4. valeurs ──────────────────────────────────────────────────────────────
const KEY_RE = /^[A-Za-z0-9_]+$/
for (const l of loaded) {
  const badKeys = new Set()
  for (const [key, val] of Object.entries(flat[l])) {
    key.split('.').forEach(part => { if (!KEY_RE.test(part)) badKeys.add(key) })
    if (typeof val !== 'string') err('valeur', `${l}.json : « ${key} » n'est pas un texte (${typeof val})`)
    else if (val.trim() === '' && !/(^|\.)fileLabel$/.test(key)) err('valeur vide', `${l}.json : « ${key} » est vide`)
  }
  badKeys.forEach(k => err('nom de clé', `${l}.json : « ${k} » contient un caractère interdit (seuls A-Z a-z 0-9 _ sont permis)`))
}

// ── 5. Variables identiques dans toutes les langues ──────────────────────────────────────────
if (flat[REF]) {
  for (const l of loaded.filter(x => x !== REF)) {
    for (const [key, refVal] of Object.entries(flat[REF])) {
      if (!(key in flat[l])) continue
      const a = placeholders(refVal), b = placeholders(flat[l][key])
      if (!a || !b) continue
      const missing = [...a].filter(x => !b.has(x)), extra = [...b].filter(x => !a.has(x))
      if (missing.length || extra.length) {
        err('variables', `${l}.json : « ${key} » — ${missing.length ? `variable(s) manquante(s) {${missing.join('}, {')}}` : ''}${missing.length && extra.length ? ' ; ' : ''}${extra.length ? `en trop {${extra.join('}, {')}}` : ''}`)
      }
    }
  }
}

// ── Avertissements ───────────────────────────────────────────────────────────────────────────
// Espaces (y compris insécables) au début ou à la fin d'un texte : presque toujours une faute de saisie.
// Exceptions voulues : les suffixes collés à une autre phrase (ex. « · 3 ignorés »).
const SPACE_OK = /(skippedSuffix|bulkSkipped|reorderSaving)$/
for (const l of loaded) {
  for (const [key, val] of Object.entries(flat[l])) {
    if (typeof val === 'string' && val !== val.trim() && !SPACE_OK.test(key)) {
      warn('espace parasite', `${l}.json : « ${key} » commence ou finit par une espace : ${JSON.stringify(val.slice(0, 40))}`)
    }
  }
}
// Textes légitimement identiques à l'anglais dans certaines langues (mot de golf international, même mot dans les deux langues…).
// Ajoutez ici une clé quand un avertissement « identique à l'anglais » est un faux positif.
const KNOWN_SAME = new Set([
  'teesheet.flight', 'myEvents.photo.count', 'communications.templates.info', 'challenge4bbb.stat2plus',
  'flights.tab4bbb', 'clubs.errorWithMessage', 'email.invitation.docTitle', 'email.teesheet.docTitle', 'email.groupInvite.docTitle',
])
if (flat[REF]) {
  const FR_ACCENTS = /[éèêàçùôîû]/
  for (const [key, val] of Object.entries(flat[REF])) {
    if (typeof val === 'string' && FR_ACCENTS.test(val.replace(/…/g, ''))) warn('anglais accentué', `en.json : « ${key} » contient des accents : « ${val.slice(0, 60)} »`)
  }
  for (const l of loaded.filter(x => x !== REF)) {
    for (const [key, val] of Object.entries(flat[l])) {
      const ref = flat[REF][key]
      if (typeof val === 'string' && !KNOWN_SAME.has(key) && val === ref && val.length >= 14 && / /.test(val) && /[a-z]{3}/.test(val) && !/http|@|golfgo|\{\{/i.test(val)) {
        warn('identique à l\'anglais', `${l}.json : « ${key} » est identique à l'anglais : « ${val.slice(0, 50)} »`)
      }
    }
  }
}

// ── 6. Clés utilisées dans le code ───────────────────────────────────────────────────────────
function walkFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === 'messages') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walkFiles(p, out)
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}
const keySet = flat[REF] ? new Set(Object.keys(flat[REF])) : new Set()
// une clé « objet » (ex. status) est valide si au moins une clé la commence
const isValidKey = k => keySet.has(k) || [...keySet].some(x => x.startsWith(k + '.'))
const usedKeys = new Set()
const dynamicPrefixes = new Set()

if (fs.existsSync(SRC_DIR) && keySet.size) {
  const bindRe = /\b(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:\{\s*namespace:\s*)?(?:(['"`])([^'"`]*)\2)?\s*\}?\s*\)/g
  const serverBindRe = /\b(?:const|let|var)\s+(\w+)\s*=\s*(?:serverT|createTranslator)\(/g
  for (const file of walkFiles(SRC_DIR)) {
    const src = fs.readFileSync(file, 'utf8')
    const rel = path.relative(ROOT, file)
    const bindings = {}                       // nom de variable -> liste de namespaces possibles
    const add = (v, ns) => { (bindings[v] = bindings[v] || new Set()).add(ns) }
    let m
    while ((m = bindRe.exec(src))) add(m[1], m[3] || '')
    while ((m = serverBindRe.exec(src))) add(m[1], '')
    // appels  x('clé')  x.rich('clé')  x.raw('clé')  — x = variable liée, ou t / *.t (fonction passée en paramètre → racine)
    const callRe = /(?<![\w$.])((?:[\w$]+\.)?t|tf|tRoot|tr|\w+)(?:\.(?:rich|raw|markup))?\(\s*(['"`])((?:(?!\2).)*)\2/g
    const candidates = new Set([...Object.keys(bindings), 't'])
    while ((m = callRe.exec(src))) {
      const varName = m[1]
      const baseVar = varName.split('.').pop()
      if (!candidates.has(varName) && !candidates.has(baseVar)) continue
      const raw = m[3]
      if (!/^[A-Za-z0-9_.${}\[\]-]+$/.test(raw) || !raw.includes('.') && !bindings[baseVar]) {
        // pas une clé plausible (ex. t('Escape'), fetch('/api') ne passent pas ici : la variable doit être liée à une traduction)
        if (!bindings[baseVar]) continue
      }
      const namespaces = bindings[baseVar] ? [...bindings[baseVar]] : ['']
      if (raw.includes('${')) { dynamicPrefixes.add(raw.split('${')[0]); continue }
      const line = src.slice(0, m.index).split('\n').length
      const resolved = namespaces.map(ns => (ns ? `${ns}.${raw}` : raw))
      // valable si UN des rattachements possibles existe (une même variable `t` peut avoir plusieurs namespaces selon le composant)
      const ok = resolved.find(isValidKey)
      if (ok) usedKeys.add(ok)
      else if (bindings[baseVar] || /^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z0-9_]+)+$/.test(raw)) {   // variable non liée (t passé en paramètre) : on valide toute clé de la forme a.b.c
        err('clé absente du code', `${rel}:${line} — t('${raw}') n'existe pas${namespaces.some(Boolean) ? ` (essayé : ${resolved.join(', ')})` : ''}`)
      }
    }
  }
  if (SHOW_UNUSED) {
    const dyn = [...dynamicPrefixes]
    const unused = [...keySet].filter(k => !usedKeys.has(k) && ![...usedKeys].some(u => k.startsWith(u + '.')) && !dyn.some(p => k.startsWith(p.replace(/\.$/, '') + '.') || k.startsWith(p)))
    console.log(bold(`\nClés apparemment inutilisées (${unused.length}) — indicatif :`))
    unused.slice(0, 200).forEach(k => console.log(dim('  ' + k)))
    if (unused.length > 200) console.log(dim(`  … et ${unused.length - 200} autres`))
  }
}

// ── Rapport ──────────────────────────────────────────────────────────────────────────────────
const group = list => list.reduce((acc, x) => { (acc[x.cat] = acc[x.cat] || []).push(x.msg); return acc }, {})
console.log(bold('\nContrôle des traductions GolfGo'))
console.log(dim(`  langues : ${loaded.join(', ')}  ·  ${flat[REF] ? Object.keys(flat[REF]).length : 0} clés  ·  code analysé : ${path.relative(ROOT, SRC_DIR)}`))

const printGroup = (title, list, colorFn) => {
  const g = group(list)
  for (const [cat, msgsList] of Object.entries(g)) {
    console.log('\n' + colorFn(`${title} — ${cat} (${msgsList.length})`))
    msgsList.slice(0, 25).forEach(m => console.log('  ' + m))
    if (msgsList.length > 25) console.log(dim(`  … et ${msgsList.length - 25} autres`))
  }
}
printGroup('ERREUR', errors, red)
printGroup('AVERTISSEMENT', warnings, yellow)

console.log('')
if (errors.length) {
  console.log(red(bold(`✗ ${errors.length} erreur(s)`)) + (warnings.length ? yellow(` · ${warnings.length} avertissement(s)`) : '') + ' — à corriger avant de déployer.')
  process.exit(1)
}
console.log(green(bold('✓ Traductions cohérentes')) + (warnings.length ? yellow(` · ${warnings.length} avertissement(s) à regarder`) : '') + ' — vous pouvez déployer.')
