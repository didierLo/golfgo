import { writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { buildScorecardHtml, type PrintPlayer } from '../src/components/scorecards/buildScorecardHtml'
import type { TeamFormat } from '../src/lib/golf/scorecards/composeCards'
import type { Hole } from '../src/components/scorecards/scorecard-types'

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

const formats: { format: TeamFormat; pct: number; label: string }[] = [
  { format: 'individual', pct: 100, label: 'stroke-stableford' },
  { format: '4bbb',       pct: 90,  label: '4bbb' },
  { format: 'team2',      pct: 50,  label: 'team2' },
  { format: 'team3_4',    pct: 25,  label: 'team3-4' },
]

for (const { format, pct, label } of formats) {
  const html = buildScorecardHtml(
    players, fallbackHoles(), `Test — ${label}`, '31 juillet 2026',
    'Royal Golf Club', 'Parcours 18 trous', null, format, pct,
  )
  const path = `/tmp/scorecard-test-${label}.html`
  writeFileSync(path, html)
  console.log('Généré :', path)
  try { execSync(`open "${path}"`) } catch {}
}