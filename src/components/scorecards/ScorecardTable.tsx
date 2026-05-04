'use client'

import { ScorecardCell } from './ScorecardCell'
import type { Hole, Player, ScoreMap } from '@/app/(app)/groups/[id]/events/[eventId]/scorecards/page'

type Props = {
  holes: Hole[]; player: Player; scores: ScoreMap
  setScores: React.Dispatch<React.SetStateAction<ScoreMap>>
  eventFormat: 'stroke' | 'stableford'; readOnly?: boolean
}

function strokesReceived(phcp: number, strokeIndex: number): number {
  if (phcp <= 0) return 0
  const full = Math.floor(phcp / 18)
  const remainder = phcp % 18
  return full + (strokeIndex <= remainder ? 1 : 0)
}

function stablefordPoints(brut: number, par: number, recv: number): number {
  return Math.max(0, par - (brut - recv) + 2)
}

export default function ScorecardTable({ holes, player, scores, setScores, eventFormat, readOnly = false }: Props) {
  const isStableford = eventFormat === 'stableford'
  const front9 = holes.filter(h => h.hole_number <= 9)
  const back9  = holes.filter(h => h.hole_number > 9)

  function updateScore(hole: number, delta: number, par: number) {
  if (readOnly) return
  setScores(prev => {
    const current = prev[player.id]?.[hole] ?? par
    return { ...prev, [player.id]: { ...prev[player.id], [hole]: Math.max(1, current + delta) } }
  })
}

  function holeStats(h: Hole) {
    const brut = scores[player.id]?.[h.hole_number] ?? null
    const recv = strokesReceived(player.phcp, h.stroke_index)
    const net  = brut != null ? brut - recv : null
    const pts  = brut != null ? stablefordPoints(brut, h.par, recv) : null
    return { brut, recv, net, pts, siMark: '*'.repeat(recv) }
  }

  function subtotals(holesList: Hole[]) {
    let parSum = 0, brutSum = 0, netSum = 0, ptsSum = 0, count = 0
    holesList.forEach(h => {
      parSum += h.par
      const { brut, net, pts } = holeStats(h)
      if (brut != null) { brutSum += brut; netSum += net!; ptsSum += pts!; count++ }
    })
    return { parSum, brutSum: count ? brutSum : null, netSum: count ? netSum : null, ptsSum: count ? ptsSum : null }
  }

  const outTotals = subtotals(front9)
  const inTotals  = subtotals(back9)
  const totTotals = subtotals(holes)
  const netLabel  = isStableford ? 'Pts' : 'Net'

  function HoleRow({ h }: { h: Hole }) {
    const { brut, siMark, net, pts } = holeStats(h)
    return (
      <tr className="border-b border-white/30 hover:bg-white/30 transition-colors">
        <td className="py-2 text-center font-black text-slate-800 text-[13px] pl-3">{h.hole_number}</td>
        <td className="py-2 text-center text-slate-600 text-[13px]">{h.par}</td>
        <td className="py-2 text-center text-slate-500 text-[12px]">{h.stroke_index}</td>
       <td className="py-1 text-center text-[13px] font-black text-black w-4">{siMark}</td>
        <td className="py-1" colSpan={3}>
          <ScorecardCell 
            value={brut} 
            defaultValue={h.par}  // ← nouveau
            onDecrement={() => updateScore(h.hole_number, -1, h.par)}  // ← passer h.par
            onIncrement={() => updateScore(h.hole_number, +1, h.par)} 
            readOnly={readOnly} 
          />
        </td>
        <td className="py-2 text-center text-slate-600 text-[13px]">{brut ?? 0}</td>
        <td className="py-2 text-center text-slate-600 text-[13px]">{isStableford ? (pts ?? 0) : (net ?? 0)}</td>
      </tr>
    )
  }

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
            <th className="py-2.5 text-center font-semibold w-12">{netLabel}</th>
          </tr>
        </thead>
        <tbody>
          {front9.map(h => <HoleRow key={h.hole_number} h={h} />)}
          <SubtotalRow label="OUT" parSum={outTotals.parSum} count={front9.length}
            brutSum={outTotals.brutSum} netSum={isStableford ? outTotals.ptsSum : outTotals.netSum} />
          {back9.map(h => <HoleRow key={h.hole_number} h={h} />)}
          <SubtotalRow label="IN" parSum={inTotals.parSum} count={back9.length}
            brutSum={inTotals.brutSum} netSum={isStableford ? inTotals.ptsSum : inTotals.netSum} />
          <SubtotalRow label="TOT" parSum={totTotals.parSum} count={holes.length}
            brutSum={totTotals.brutSum} netSum={isStableford ? totTotals.ptsSum : totTotals.netSum} isTot />
        </tbody>
      </table>
    </div>
  )
}

function SubtotalRow({ label, parSum, count, brutSum, netSum, isTot = false }: {
  label: string; parSum: number; count: number; brutSum: number | null; netSum: number | null; isTot?: boolean
}) {
  return (
    <tr className={`border-b text-[13px] font-bold ${isTot ? 'bg-slate-200' : 'bg-slate-100'}`}>
      <td className="py-2 text-slate-800 text-center pl-3">{label}</td>
      <td className="py-2 text-center">{parSum}</td>
      <td className="py-2 text-center text-slate-400 font-normal">{count}</td>
      <td /><td colSpan={3} />
      <td className="py-2 text-center">{brutSum ?? ''}</td>
      <td className="py-2 text-center">{netSum ?? ''}</td>
    </tr>
  )
}
