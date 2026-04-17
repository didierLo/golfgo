'use client'

import * as XLSX from 'xlsx'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type PlayerPreview = {
  federal_no: string; first_name: string; surname: string; whs: number | null
  email: string | null; phone: string | null; home_club: string | null
  status: 'NEW' | 'UPDATE' | 'EXISTS'
}

const STATUS_STYLE = {
  NEW:    { label: 'Nouveau',     bg: '#EAF3DE', text: '#3B6D11' },
  UPDATE: { label: 'Mise à jour', bg: '#FAEEDA', text: '#854F0B' },
  EXISTS: { label: 'Existant',    bg: '#F1F5F9', text: '#64748B' },
}

function normalizeColumn(name: string) {
  const n = name.toLowerCase()
  if (n.includes('federal') || n.includes('licence') || n.includes('license')) return 'federal_no'
  if (n.includes('first') || n.includes('prenom')) return 'first_name'
  if (n.includes('surname') || n.includes('nom')) return 'surname'
  if (n.includes('whs') || n.includes('handicap') || n.includes('index')) return 'whs'
  if (n.includes('mail')) return 'email'
  if (n.includes('phone') || n.includes('gsm') || n.includes('tel')) return 'phone'
  if (n.includes('club')) return 'home_club'
  return name
}

function cleanPhone(p: any) { if (!p) return null; return String(p).replace(/[^0-9+]/g, '').trim() }
function cleanWHS(v: any) { if (!v) return null; const n = Number(String(v).replace(',', '.')); return isNaN(n) ? null : n }

export default function ImportPlayers() {
  const [preview, setPreview]   = useState<PlayerPreview[]>([])
  const [loading, setLoading]   = useState(false)
  const [groups, setGroups]     = useState<{ id: string; name: string }[]>([])
  const [groupId, setGroupId]   = useState('')
  const [mode, setMode]         = useState<'insert' | 'update'>('insert')

  useEffect(() => { loadGroups() }, [])

  async function loadGroups() {
    const { data } = await supabase.from('groups').select('id, name').order('name')
    setGroups(data || [])
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer)
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const raw: any[] = XLSX.utils.sheet_to_json(sheet)
    const normalized = raw.map(row => { const obj: any = {}; Object.keys(row).forEach(k => { obj[normalizeColumn(k)] = row[k] }); return obj })
    await buildPreview(normalized)
  }

  async function buildPreview(data: any[]) {
    const federals = data.map(r => String(r.federal_no || '').trim().toUpperCase())
    const { data: existing } = await supabase.from('players').select('federal_no, whs').in('federal_no', federals)
    const map = new Map(); existing?.forEach(p => map.set(p.federal_no, p))
    const previewRows: PlayerPreview[] = data.map((r, i) => {
      let federal = String(r.federal_no || '').trim().toUpperCase()
      if (!federal) federal = `AUTO_${Date.now()}_${i}`
      const whs = cleanWHS(r.whs)
      const existingPlayer = map.get(federal)
      let status: 'NEW' | 'UPDATE' | 'EXISTS' = 'NEW'
      if (existingPlayer) status = existingPlayer.whs !== whs ? 'UPDATE' : 'EXISTS'
      return {
        federal_no: federal,
        first_name: String(r.first_name || '').trim().replace(/\b\w/g, l => l.toUpperCase()),
        surname:    String(r.surname || '').trim().toUpperCase(),
        whs, email: r.email || null, phone: cleanPhone(r.phone), home_club: r.home_club || null, status,
      }
    })
    const map2 = new Map(); previewRows.forEach(p => map2.set(p.federal_no, p))
    setPreview(Array.from(map2.values()))
  }

  async function importPlayers() {
    setLoading(true)
    let toImport = preview
    if (mode === 'insert') toImport = preview.filter(p => p.status === 'NEW')
    if (mode === 'update') toImport = preview.filter(p => p.status !== 'EXISTS')
    const rows = toImport.map(p => ({ federal_no: p.federal_no, first_name: p.first_name, surname: p.surname, whs: p.whs, email: p.email, phone: p.phone, home_club: p.home_club }))
    const { data, error } = await supabase.from('players').upsert(rows, { onConflict: 'federal_no' }).select('id')
    if (error) { alert(error.message); setLoading(false); return }
    if (groupId && data) {
      const playerIds = data.map(p => p.id)
      const { data: existingMembers } = await supabase.from('groups_players').select('player_id, role').eq('group_id', groupId).in('player_id', playerIds)
      const existingRoleMap: Record<string, string> = {}; existingMembers?.forEach(m => { existingRoleMap[m.player_id] = m.role })
      const newMembers = data.filter(p => !existingRoleMap[p.id])
      if (newMembers.length > 0) await supabase.from('groups_players').insert(newMembers.map(p => ({ group_id: groupId, player_id: p.id, role: 'member' })))
    }
    alert(`${rows.length} joueur(s) importé(s)`)
    setPreview([]); setLoading(false)
  }

  const newCount    = preview.filter(p => p.status === 'NEW').length
  const updateCount = preview.filter(p => p.status === 'UPDATE').length
  const existsCount = preview.filter(p => p.status === 'EXISTS').length

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Fichier CSV / XLS / XLSX</label>
        <input type="file" accept=".csv,.xls,.xlsx" onChange={handleFile}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[13px] text-slate-600 file:mr-3 file:border-0 file:bg-[#EBF3FC] file:text-[#185FA5] file:text-[12px] file:font-semibold file:px-3 file:py-1 file:rounded-lg cursor-pointer" />
      </div>

      <div>
        <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Ajouter au groupe (optionnel)</label>
        <select value={groupId} onChange={e => setGroupId(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30">
          <option value="">Sans groupe</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {preview.length > 0 && (
        <>
          <div className="flex gap-2 flex-wrap">
            {[{ n: newCount, ...STATUS_STYLE.NEW }, { n: updateCount, ...STATUS_STYLE.UPDATE }, { n: existsCount, ...STATUS_STYLE.EXISTS }].map(({ n, label, bg, text }) => (
              <div key={label} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold" style={{ background: bg, color: text }}>
                <span className="font-black">{n}</span> {label}
              </div>
            ))}
          </div>

          <div className="flex gap-4">
            {(['insert', 'update'] as const).map(m => (
              <label key={m} className="flex items-center gap-2 text-[12px] font-medium text-slate-700 cursor-pointer">
                <input type="radio" value={m} checked={mode === m} onChange={() => setMode(m)} className="accent-[#185FA5]" />
                {m === 'insert' ? 'Nouveaux seulement' : 'Nouveaux + mises à jour'}
              </label>
            ))}
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
            {preview.map((p, i) => {
              const s = STATUS_STYLE[p.status]
              return (
                <div key={i} className={`flex items-center justify-between px-3 py-2.5 text-[12px] ${i < preview.length - 1 ? 'border-b border-slate-100' : ''}`}>
                  <span className="font-medium text-slate-800">{p.first_name} {p.surname}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-mono">{p.federal_no}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: s.bg, color: s.text }}>{s.label}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <button onClick={importPlayers} disabled={loading}
            className="flex items-center gap-2 bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
            {loading && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {loading ? 'Import en cours…' : `Importer ${mode === 'insert' ? newCount : newCount + updateCount} joueur(s)`}
          </button>
        </>
      )}
    </div>
  )
}
