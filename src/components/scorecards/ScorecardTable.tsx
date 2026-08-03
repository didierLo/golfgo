'use client'
import { useMemo } from 'react'
import { ScorecardCell } from './ScorecardCell'
import type { Hole, ScoreMap } from './scorecard-types'

// ScorecardTable n'a besoin que de id + phcp — reste volontairement minimal pour accepter
// aussi bien un Player réel qu'une "carte d'équipe virtuelle" (team2/team3_4) ou un PrintPlayer.
export type ScoreEntrant = { id: string; phcp: number }

type Props = {
  holes: Hole[]
  // 1 joueur = saisie individuelle OU carte d'équipe partagée (team2/team3_4 : passer un "joueur virtuel"
  //   dont l'id = joueur ancre et le phcp = phcp d'équipe — cf. composeCards)
  // 2 joueurs = 4BBB : chacun sa balle, vue groupée avec meilleure balle surlignée
  players: ScoreEntrant[]
  scores: ScoreMap
  setScores: React.Dispatch<React.SetStateAction<ScoreMap>>
  eventFormat: 'stroke' | 'stableford'
  readOnly?: boolean
}

function strokesReceived(phcp: number, strokeIndex: number): number {
  if (phcp <= 0) return 0
  const full = Math.floor(phcp / 18)
  const remainder = phcp % 18
  return full + (strokeIndex <= remainder ? 1 : 0)
}

// net-par : 0→2, 1→1, >1→0, -1→3, -2→4 (et au-delà, clampé à 0 en haut)
function stablefordPoints(brut: number, par: number, recv: number): number {
  return Math.max(0, par - (brut - recv) + 2)
}

function holeValues(player: ScoreEntrant, hole: Hole, scores: ScoreMap) {
  const brut = scores[player.id]?.[hole.hole_number] ?? null
  if (brut == null) return { brut: null as number | null, net: null as number | null, pts: null as number | null }
  const recv = strokesReceived(player.phcp, hole.stroke_index)
  const net  = brut - recv
  const pts  = stablefordPoints(brut, hole.par, recv)
  return { brut, net, pts }
}

function subtotals(holesList: Hole[], player: ScoreEntrant, scores: ScoreMap) {
  let parSum = 0, brutSum = 0, netSum = 0, ptsSum = 0, count = 0
  holesList.forEach(h => {
    parSum += h.par
    const { brut, net, pts } = holeValues(player, h, scores)
    if (brut != null) { brutSum += brut; netSum += net!; ptsSum += pts!; count++ }
  })
  return { parSum, brutSum: count ? brutSum : null, netSum: count ? netSum : null, ptsSum: count ? ptsSum : null }
}

// Sous-total "meilleure balle" (4BBB) : le meilleur des 2 scores du trou
// (Stb le plus haut en stableford, Net le plus bas en stroke-play)
function bestBallSubtotal(holesList: Hole[], players: ScoreEntrant[], scores: ScoreMap, isStableford: boolean) {
  let parSum = 0, sum = 0, count = 0
  holesList.forEach(h => {
    parSum += h.par
    const vals = players.map(p => holeValues(p, h, scores)).filter(v => v.brut != null)
    if (!vals.length) return
    const best = isStableford ? Math.max(...vals.map(v => v.pts!)) : Math.min(...vals.map(v => v.net!))
    sum += best; count++
  })
  return { parSum, sum: count ? sum : null }
}

export default function ScorecardTable({ holes, players, scores, setScores, eventFormat, readOnly = false }: Props) {
  const isStableford = eventFormat === 'stableford'
  const isPair        = players.length === 2 // 4BBB
  const front9 = holes.filter(h => h.hole_number <= 9)
  const back9  = holes.filter(h => h.hole_number > 9)

  function updateScore(pid: string, hole: number, delta: number, par: number) {
    if (readOnly) return
    setScores((prev: ScoreMap) => {
      const current = prev[pid]?.[hole] ?? par
      return { ...prev, [pid]: { ...prev[pid], [hole]: Math.max(1, current + delta) } }
    })
  }

  const subs = useMemo(() => players.map(p => ({
    out: subtotals(front9, p, scores), in: subtotals(back9, p, scores), tot: subtotals(holes, p, scores),
  })), [front9, back9, holes, players, scores])

  const bestSubs = useMemo(() => isPair ? {
    out: bestBallSubtotal(front9, players, scores, isStableford),
    in:  bestBallSubtotal(back9, players, scores, isStableford),
    tot: bestBallSubtotal(holes, players, scores, isStableford),
  } : null, [isPair, front9, back9, holes, players, scores, isStableford])

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      {readOnly && <p className="text-[11px] text-slate-400 mb-2 italic">Lecture seule</p>}
      <table className="border-collapse text-[13px] w-full">
        <thead>
          <tr className="text-[11px] text-slate-500 border-b border-white/40">
            <th className="py-2.5 text-center font-semibold text-slate-700 w-10">Hole</th>
            <th className="py-2.5 text-center font-semibold w-10">Par</th>
            <th className="py-2.5 text-center font-semibold w-12">SI</th>
            <th className="py-2.5 text-center font-semibold w-4" />
            <th className="py-2.5 text-center font-semibold" colSpan={3}>Score</th>
            <th className="py-2.5 text-center font-semibold w-12">Brut</th>
            <th className="py-2.5 text-center font-semibold w-12">Net</th>
            {isStableford && <th className="py-2.5 text-center font-semibold w-12">Stb</th>}
          </tr>
        </thead>
        <tbody>
          {front9.map(h => (
            <HoleBlock key={h.hole_number} h={h} players={players} scores={scores}
              onUpdate={updateScore} isStableford={isStableford} readOnly={readOnly} />
          ))}
          <SubtotalBlock label="OUT" players={players} subs={subs.map(s => s.out)} bestSub={bestSubs?.out}
            isStableford={isStableford} count={front9.length} />
          {back9.map(h => (
            <HoleBlock key={h.hole_number} h={h} players={players} scores={scores}
              onUpdate={updateScore} isStableford={isStableford} readOnly={readOnly} />
          ))}
          <SubtotalBlock label="IN" players={players} subs={subs.map(s => s.in)} bestSub={bestSubs?.in}
            isStableford={isStableford} count={back9.length} />
          <SubtotalBlock label="TOT" players={players} subs={subs.map(s => s.tot)} bestSub={bestSubs?.tot}
            isStableford={isStableford} count={holes.length} isTot />
        </tbody>
      </table>
    </div>
  )
}

// ─── HoleBlock — 1 ligne (individuel / carte d'équipe partagée) ou 2 lignes (4BBB) ──

type HoleBlockProps = {
  h: Hole
  players: ScoreEntrant[]
  scores: ScoreMap
  onUpdate: (pid: string, hole: number, delta: number, par: number) => void
  isStableford: boolean
  readOnly: boolean
}

function HoleBlock({ h, players, scores, onUpdate, isStableford, readOnly }: HoleBlockProps) {
  const rows = players.map(p => ({ player: p, ...holeValues(p, h, scores) }))
  const isPair = players.length === 2
  const bothEntered = isPair && rows[0].brut != null && rows[1].brut != null
  const bestIdx = isPair
    ? (isStableford
        ? (rows[0].pts ?? -Infinity) >= (rows[1].pts ?? -Infinity) ? 0 : 1
        : (rows[0].net ?? Infinity) <= (rows[1].net ?? Infinity) ? 0 : 1)
    : 0

  return (
    <>
      {rows.map((row, i) => {
        const recv = strokesReceived(row.player.phcp, h.stroke_index)
        const isWinner = isPair && bothEntered && i === bestIdx
        return (
          <tr key={row.player.id}
            className={`border-b ${i === rows.length - 1 ? 'border-white/30' : 'border-white/10'} hover:bg-white/30 transition-colors ${isWinner ? 'bg-[#EAF3DE]/60' : ''}`}>
            {i === 0 && (
              <>
                <td rowSpan={rows.length} className="py-2 text-center font-black text-slate-800 text-[13px] pl-3 align-middle">{h.hole_number}</td>
                <td rowSpan={rows.length} className="py-2 text-center text-slate-600 text-[13px] align-middle">{h.par}</td>
                <td rowSpan={rows.length} className="py-2 text-center text-slate-500 text-[12px] align-middle">{h.stroke_index}</td>
              </>
            )}
            <td className="py-1 text-center text-[13px] font-black text-black w-4">{'*'.repeat(recv)}</td>
            <td className="py-1" colSpan={3}>
              <ScorecardCell
                value={row.brut}
                defaultValue={h.par}
                onDecrement={() => onUpdate(row.player.id, h.hole_number, -1, h.par)}
                onIncrement={() => onUpdate(row.player.id, h.hole_number, +1, h.par)}
                readOnly={readOnly}
              />
            </td>
            <td className="py-2 text-center text-slate-600 text-[13px]">{row.brut ?? 0}</td>
            <td className={`py-2 text-center text-[13px] ${isWinner ? 'font-black text-[#3B6D11]' : 'text-slate-600'}`}>{row.net ?? 0}</td>
            {isStableford && (
              <td className={`py-2 text-center text-[13px] ${isWinner ? 'font-black text-[#3B6D11]' : 'text-slate-600'}`}>{row.pts ?? 0}</td>
            )}
          </tr>
        )
      })}
    </>
  )
}

// ─── SubtotalBlock ──────────────────────────────────────────────────────────

function SubtotalBlock({ label, players, subs, bestSub, isStableford, count, isTot = false }: {
  label: string
  players: ScoreEntrant[]
  subs: { parSum: number; brutSum: number | null; netSum: number | null; ptsSum: number | null }[]
  bestSub?: { parSum: number; sum: number | null } | null
  isStableford: boolean
  count: number
  isTot?: boolean
}) {
  const isPair = players.length === 2
  const bg = isTot ? 'bg-slate-200' : 'bg-slate-100'

  if (!isPair) {
    const s = subs[0]
    return (
      <tr className={`border-b text-[13px] font-bold ${bg}`}>
        <td className="py-2 text-slate-800 text-center pl-3">{label}</td>
        <td className="py-2 text-center">{s.parSum}</td>
        <td className="py-2 text-center text-slate-400 font-normal">{count}</td>
        <td /><td colSpan={3} />
        <td className="py-2 text-center">{s.brutSum ?? ''}</td>
        <td className="py-2 text-center">{s.netSum ?? ''}</td>
        {isStableford && <td className="py-2 text-center">{s.ptsSum ?? ''}</td>}
      </tr>
    )
  }

  return (
    <>
      {subs.map((s, i) => (
        <tr key={players[i].id} className={`border-b text-[13px] font-semibold ${bg}`}>
          {i === 0 && <td rowSpan={3} className="py-2 text-slate-800 text-center pl-3 align-middle">{label}</td>}
          {i === 0 && <td rowSpan={3} className="py-2 text-center align-middle">{s.parSum}</td>}
          {i === 0 && <td rowSpan={3} className="py-2 text-center text-slate-400 font-normal align-middle">{count}</td>}
          <td /><td colSpan={3} />
          <td className="py-2 text-center">{s.brutSum ?? ''}</td>
          <td className="py-2 text-center">{s.netSum ?? ''}</td>
          {isStableford && <td className="py-2 text-center">{s.ptsSum ?? ''}</td>}
        </tr>
      ))}
      <tr className={`border-b text-[13px] font-black ${isTot ? 'bg-[#DBEAFE]' : 'bg-[#EAF3DE]'}`}>
        <td className="py-2 text-right pr-2 text-[11px] uppercase tracking-wide text-slate-600" colSpan={isStableford ? 9 : 8}>
          Meilleure balle
        </td>
        <td className="py-2 text-center">{bestSub?.sum ?? ''}</td>
      </tr>
    </>
  )
}