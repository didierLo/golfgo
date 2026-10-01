import { writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { buildScorecardHtml, type PrintPlayer } from '../src/components/scorecards/buildScorecardHtml'
import type { TeamFormat } from '../src/lib/golf/scorecards/composeCards'
import type { HcpRule } from '../src/lib/golf/scoring/handicapAllowance'
import type { Hole } from '../src/components/scorecards/scorecard-types'
import { serverT, normalizeLocale } from '../src/lib/i18n/server'

// Langue de test : LOCALE=en npx tsx scripts/test-scorecards.ts   (par défaut : fr)
const lang = normalizeLocale(process.env.LOCALE ?? 'fr')
const i18n = { t: serverT(lang), lang }

function fallbackHoles(): Hole[] {
  return Array.from({ length: 18 }, (_, i) => ({
    hole_number: i + 1, par: [4, 4, 3, 5, 4, 4, 3, 4, 5][i % 9], stroke_index: i + 1,
  }))
}

function mockPlayer(id: string, first_name: string, surname: string, phcp: number): PrintPlayer {
  return { id, first_name, surname, whs: phcp, phcp }
}

const players: PrintPlayer[] = [
  mockPlayer('1', 'Didier', 'Lozet', 12),
  mockPlayer('2', 'Marc', 'Dubois', 18),
  mockPlayer('3', 'Anne', 'Peeters', 24),
  mockPlayer('4', 'Luc', 'Janssens', 8),
]

// Coefficients WHS (Appendice C), du plus bas handicap au plus haut
const formats: { format: TeamFormat; rule: HcpRule; label: string }[] = [
  { format: 'individual', rule: { allowances: [100], matchPlay: false },          label: 'stroke-stableford' },
  { format: 'individual', rule: { allowances: [100], matchPlay: true },           label: 'matchplay' },
  { format: '4bbb',       rule: { allowances: [85], matchPlay: false },           label: '4bbb' },
  { format: 'team2',      rule: { allowances: [60, 40], matchPlay: false },       label: 'greensome' },
  { format: 'team2',      rule: { allowances: [35, 15], matchPlay: false },       label: 'scramble2' },
  { format: 'team3_4',    rule: { allowances: [25, 20, 15, 10], matchPlay: false }, label: 'scramble4' },
]

for (const { format, rule, label } of formats) {
  const html = buildScorecardHtml(
    i18n, players, fallbackHoles(), `Test — ${label}`, '31 juillet 2026',
    'Royal Golf Club', 'Parcours 18 trous', null, format, rule,
  )
  const path = `/tmp/scorecard-test-${label}.html`
  writeFileSync(path, html)
  console.log('Généré :', path)
  try { execSync(`open "${path}"`, { stdio: "ignore" }) } catch {}
}