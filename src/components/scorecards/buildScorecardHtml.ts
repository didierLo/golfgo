import type { Hole, TeeInfo } from './scorecard-types'
import { composeCards, type TeamFormat, type ComposedCard } from '@/lib/golf/scorecards/composeCards'

const DEFAULT_LOGO_URL = 'https://golfgo.be/logo/GG_Logo_avec_nom_bandeau.jpeg'

export type PrintPlayer = {
  id: string
  first_name: string
  surname: string
  whs: number
  phcp: number
  tee?: TeeInfo
}

function strokesReceived(playingHcp: number, strokeIndex: number): number {
  if (playingHcp <= 0) return 0
  const full = Math.floor(playingHcp / 18)
  const remainder = playingHcp % 18
  return full + (strokeIndex <= remainder ? 1 : 0)
}

export function buildScorecardHtml(
  players: PrintPlayer[],
  holes: Hole[],
  eventTitle: string,
  eventDate: string,
  clubName: string,
  courseName: string,
  logoUrl: string | null = null,
  teamFormat: TeamFormat = 'individual',
  hcpPercentage: number = 100,
): string {
  const resolvedLogoUrl = logoUrl || DEFAULT_LOGO_URL
  const eventLocation = [clubName, courseName].filter(Boolean).join(' · ')

  const front9   = holes.filter(h => h.hole_number <= 9)
  const back9    = holes.filter(h => h.hole_number > 9)
  const frontPar = front9.reduce((s, h) => s + h.par, 0)
  const backPar  = back9.reduce((s, h) => s + h.par, 0)
  const totalPar = frontPar + backPar

  function recv(playingHcp: number, set: Hole[]) {
    return set.reduce((s, h) => s + strokesReceived(playingHcp, h.stroke_index), 0)
  }

  const composed: ComposedCard[] = composeCards(players, teamFormat, hcpPercentage)

  const cards = composed.map(card => {
    const holeHeaders = [
      ...front9.map(h => `<th class="hole-cell">${h.hole_number}</th>`),
      `<th class="hole-cell sub">Out</th>`,
      ...back9.map(h => `<th class="hole-cell">${h.hole_number}</th>`),
      `<th class="hole-cell sub">In</th>`,
      `<th class="hole-cell tot">Total</th>`,
    ].join('')

    const parRow = [
      ...front9.map(h => `<td class="hole-cell">${h.par}</td>`),
      `<td class="hole-cell sub-val">${frontPar}</td>`,
      ...back9.map(h => `<td class="hole-cell">${h.par}</td>`),
      `<td class="hole-cell sub-val">${backPar}</td>`,
      `<td class="hole-cell tot-val">${totalPar}</td>`,
    ].join('')

    const siRow = [
      ...front9.map(h => `<td class="hole-cell si">${h.stroke_index}</td>`),
      `<td class="hole-cell sub-val"></td>`,
      ...back9.map(h => `<td class="hole-cell si">${h.stroke_index}</td>`),
      `<td class="hole-cell sub-val"></td>`,
      `<td class="hole-cell tot-val"></td>`,
    ].join('')

    function hcpRowFor(playingHcp: number) {
      return [
        ...front9.map(h => {
          const r = strokesReceived(playingHcp, h.stroke_index)
          return `<td class="hole-cell hcp-cell">${r > 0 ? '*'.repeat(r) : '·'}</td>`
        }),
        `<td class="hole-cell hcp-sub">${recv(playingHcp, front9)}</td>`,
        ...back9.map(h => {
          const r = strokesReceived(playingHcp, h.stroke_index)
          return `<td class="hole-cell hcp-cell">${r > 0 ? '*'.repeat(r) : '·'}</td>`
        }),
        `<td class="hole-cell hcp-sub">${recv(playingHcp, back9)}</td>`,
        `<td class="hole-cell hcp-tot">${recv(playingHcp, holes)}</td>`,
      ].join('')
    }

    function blankRow(cls: string) {
      return [
        ...front9.map(() => `<td class="hole-cell ${cls}"></td>`),
        `<td class="hole-cell sub-val"></td>`,
        ...back9.map(() => `<td class="hole-cell ${cls}"></td>`),
        `<td class="hole-cell sub-val"></td>`,
        `<td class="hole-cell tot-val"></td>`,
      ].join('')
    }

    const mainRowsHtml = card.mainRows.map(row => `
      <tr class="hcp-row">
        <td class="label-col hcp-label">HCP</td>
        ${hcpRowFor(row.playingHcp)}
      </tr>
      <tr class="score-row">
        <td class="label-col player-label">${row.label}</td>
        ${blankRow('score-cell')}
      </tr>
      <tr class="net-row">
        <td class="label-col net-label">Net</td>
        ${blankRow('net-cell')}
      </tr>`).join('')

    const refRowsHtml = card.refRows.map(row => `
      <tr class="score-row">
        <td class="label-col player-label">${row.label}</td>
        ${blankRow('score-cell')}
      </tr>
      <tr class="net-row">
        <td class="label-col net-label">Net</td>
        ${blankRow('net-cell')}
      </tr>`).join('')

    const signerName = card.refRows[0]?.label ?? ''

    return `
<div class="card">
  <div class="header">
    <div class="logo"><img src="${resolvedLogoUrl}" alt="GolfGo" class="logo-img"/></div>
    <div class="event-info">
      <div class="event-title">${eventTitle}</div>
      <div class="event-sub">${eventDate}${eventLocation ? ' · ' + eventLocation : ''}</div>
    </div>
    <div class="player-info">
      <div class="player-line"><strong>${card.headerLabel}</strong></div>
      <div class="marker-line">${signerName ? `Marker : <u>${signerName}</u>` : '&nbsp;'}</div>
    </div>
  </div>

  <table>
    <colgroup>
      <col class="label-col" />
      ${front9.map(() => '<col class="hole-col" />').join('')}
      <col class="sub-col" />
      ${back9.map(() => '<col class="hole-col" />').join('')}
      <col class="sub-col" />
      <col class="tot-col" />
    </colgroup>
    <thead>
      <tr class="hole-row"><th class="label-col">Hole</th>${holeHeaders}</tr>
    </thead>
    <tbody>
      <tr class="par-row"><td class="label-col">Par</td>${parRow}</tr>
      <tr class="si-row"><td class="label-col">S.I.</td>${siRow}</tr>
      ${mainRowsHtml}
      ${refRowsHtml}
    </tbody>
  </table>

  <div class="footer">
    <div class="footer-cell">
      <div class="footer-label">Marker's signature</div>
      <div class="footer-name">${signerName}</div>
    </div>
    <div class="footer-cell">
      <div class="footer-label">Player's signature</div>
      <div class="footer-name">${card.headerLabel}</div>
    </div>
    <div class="footer-cell footer-score"><div class="footer-label">Brut :</div></div>
    <div class="footer-cell footer-score"><div class="footer-label">Net :</div></div>
  </div>
</div>`
  }).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Scorecards — ${eventTitle}</title>
<style>${SCORECARD_PRINT_STYLES}</style>
</head>
<body>
${cards}
<script>window.onload = () => window.print()</script>
</body>
</html>`
}

const SCORECARD_PRINT_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
  body { font-family: Arial, sans-serif; background: white; }
  @page { size: A4 landscape; margin: 8mm; }
  @media print {
    .card { page-break-after: always; }
    .card:last-child { page-break-after: auto; }
  }
  .card { width: 100%; padding: 4mm; display: flex; flex-direction: column; gap: 4mm; }
  .header { display: flex; align-items: center; gap: 6mm; }
  .logo { flex-shrink: 0; }
  .logo-img { height: 18mm; object-fit: contain; }
  .event-info { flex: 1; text-align: center; }
  .event-title { font-size: 16px; font-weight: 900; color: #0F172A; text-decoration: underline; }
  .event-sub { font-size: 11px; color: #64748B; margin-top: 3px; }
  .player-info { text-align: right; font-size: 13px; flex-shrink: 0; min-width: 240px; }
  .player-info div { margin-bottom: 3px; }
  .marker-line { color: #334155; }
  table { width: 260mm; border-collapse: collapse; table-layout: fixed; border: 2px solid #185FA5; }
  .label-col { width: 22mm; }
  .hole-col  { width: 10mm; }
  .sub-col   { width: 15mm; }
  .tot-col   { width: 15mm; }
  .label-col { text-align: left; padding: 0 6px; font-size: 10px; font-weight: 600; color: #475569; border: 1px solid #CBD5E1; white-space: nowrap; background: #fff; }
  .hole-cell { text-align: center; border: 1px solid #CBD5E1; }
  .hole-row th, .hole-row td.label-col, .par-row td, .si-row td, .hcp-row td { height: 8mm; }
  .score-row td, .net-row td { height: 10mm; }
  .hole-row th { background: #3B6D11; color: #FFFFFF; font-size: 11px; font-weight: 700; border: 1px solid rgba(255,255,255,0.3); }
  .hole-row .label-col { background: #3B6D11; color: #FFFFFF; font-size: 12px; }
  .hole-row th.sub { background: #2A5009; }
  .hole-row th.tot { background: #185FA5; }
  .par-row td { font-size: 11px; color: #334155; background: #F8FAFC; }
  .par-row .label-col { font-size: 11px; }
  .si-row td { font-size: 10px; color: #94A3B8; }
  .si-row .label-col { color: #475569; font-weight: 600; font-size: 10px; }
  .hcp-row td { font-size: 11px; font-weight: 700; background: #EBF3FC; color: #185FA5; border-bottom: 2px solid #185FA5; }
  .hcp-row .hcp-label { color: #185FA5; font-weight: 700; font-size: 11px; background: #EBF3FC; }
  .hcp-row .hcp-cell { color: #185FA5; }
  .sub-val { background: #EAF3DE !important; border-left: 1px solid #185FA5; }
  .tot-val { background: #DBEAFE !important; border-left: 1px solid #185FA5; font-weight: 900; }
  .hcp-row .sub-val, .hcp-row .hcp-sub { background: #D7EAC3 !important; font-weight: 700; }
  .hcp-row .tot-val, .hcp-row .hcp-tot { background: #BFDBFE !important; font-weight: 900; color: #1E40AF; }
  .score-row .label-col.player-label { font-size: 10px; font-weight: 700; color: #0F172A; padding: 0 6px; }
  .score-row .score-cell { background: white; }
  .net-row .net-label { font-size: 10px; font-style: italic; color: #64748B; padding: 0 6px; }
  .net-row .net-cell { background: #F8FAFC; }
  .footer { display: grid; grid-template-columns: 85mm 85mm 40mm 40mm; border: 2px solid #185FA5; border-radius: 4px; overflow: hidden; width: 260mm; }
  .footer-cell { height: 20mm; padding: 10px 14px; border-right: 1px solid #185FA5; }
  .footer-cell:last-child { border-right: none; }
  .footer-score { background: #F8FAFC; }
  .footer-label { font-size: 9px; color: #94A3B8; margin-bottom: 10px; }
  .footer-name { font-size: 12px; font-weight: 700; color: #0F172A; }
`