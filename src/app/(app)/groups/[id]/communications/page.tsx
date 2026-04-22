'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const supabase = createClient()

type Member = {
  id: string
  first_name: string
  surname: string
  email: string | null
  role: string
}

type Event = {
  id: string
  title: string
  starts_at: string
}

type ParticipantStatus = 'GOING' | 'INVITED' | 'DECLINED' | 'WAITLIST'

const TEMPLATES = [
  {
    id: 'reminder',
    label: '⏰ Rappel événement',
    subject: 'Rappel : {{group_name}}',
    body: `Bonjour {{first_name}},

Nous voulions te rappeler qu'un événement est prévu prochainement.

N'oublie pas de confirmer ta participation si ce n'est pas encore fait.

À bientôt sur le parcours !`,
  },
  {
    id: 'info',
    label: '📢 Information générale',
    subject: 'Information — {{group_name}}',
    body: `Bonjour {{first_name}},

Nous souhaitons te communiquer une information importante concernant notre groupe.

`,
  },
  {
    id: 'weather',
    label: '🌧️ Alerte météo',
    subject: 'Information météo — {{group_name}}',
    body: `Bonjour {{first_name}},

Suite aux prévisions météo, nous te tenons informé(e) de la situation concernant notre prochain événement.

Nous reviendrons vers toi dès que possible avec plus d'informations.

Merci de ta compréhension.`,
  },
  {
    id: 'cancel',
    label: '❌ Annulation',
    subject: 'Annulation — {{group_name}}',
    body: `Bonjour {{first_name}},

Nous sommes au regret de t'informer que l'événement est annulé.

Nous t'informerons dès que possible d'une nouvelle date.

Toutes nos excuses pour la gêne occasionnée.`,
  },
  {
    id: 'free',
    label: '✏️ Message libre',
    subject: '',
    body: '',
  },
]

const VARIABLES = [
  { key: '{{first_name}}',  label: 'Prénom' },
  { key: '{{surname}}',     label: 'Nom' },
  { key: '{{player_name}}', label: 'Prénom + Nom' },
  { key: '{{group_name}}',  label: 'Nom du groupe' },
]

export default function CommunicationsPage() {
  const params  = useParams()
  const groupId = params.id as string

  const [members,          setMembers]          = useState<Member[]>([])
  const [events,           setEvents]           = useState<Event[]>([])
  const [selectedIds,      setSelectedIds]      = useState<Set<string>>(new Set())
  const [filterMode,       setFilterMode]       = useState<'all' | 'event' | 'role'>('all')
  const [selectedEvent,    setSelectedEvent]    = useState<string>('')
  const [selectedStatus,   setSelectedStatus]   = useState<ParticipantStatus>('GOING')
  const [subject,          setSubject]          = useState('')
  const [body,             setBody]             = useState('')
  const [activeTemplate,   setActiveTemplate]   = useState<string | null>(null)
  const [sending,          setSending]          = useState(false)
  const [preview,          setPreview]          = useState(false)
  const [loading,          setLoading]          = useState(true)

  useEffect(() => { loadData() }, [groupId])

  async function loadData() {
    setLoading(true)
    const { data: membersData } = await supabase
      .from('groups_players')
      .select('role, player:players(id, first_name, surname, email)')
      .eq('group_id', groupId)
    setMembers((membersData ?? []).map((r: any) => ({ ...r.player, role: r.role })))

    const { data: eventsData } = await supabase
      .from('events')
      .select('id, title, starts_at')
      .eq('group_id', groupId)
      .order('starts_at', { ascending: false })
    setEvents(eventsData ?? [])

    setLoading(false)
  }

  // Sélection auto selon filtre event+statut
  async function applyEventFilter() {
    if (!selectedEvent) return
    const { data } = await supabase
      .from('event_participants')
      .select('player_id')
      .eq('event_id', selectedEvent)
      .eq('status', selectedStatus)
    const ids = new Set((data ?? []).map((r: any) => r.player_id as string))
    // Garder seulement ceux qui sont membres du groupe
    const memberIds = new Set(members.map(m => m.id))
    setSelectedIds(new Set([...ids].filter(id => memberIds.has(id))))
  }

  function toggleMember(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(membersWithEmail.map(m => m.id)))
  }

  function selectNone() { setSelectedIds(new Set()) }

  function applyTemplate(tplId: string) {
    const tpl = TEMPLATES.find(t => t.id === tplId)
    if (!tpl) return
    setActiveTemplate(tplId)
    setSubject(tpl.subject)
    setBody(tpl.body)
  }

  function insertVariable(varKey: string) {
    setBody(prev => prev + varKey)
  }

  const membersWithEmail = useMemo(() =>
    [...members].sort((a, b) => a.surname.localeCompare(b.surname, 'fr')),
  [members])

  const selectedMembers = membersWithEmail.filter(m => selectedIds.has(m.id))

  // Prévisualisation avec le premier destinataire
  const previewVars = selectedMembers[0] ? {
    first_name:  selectedMembers[0].first_name,
    surname:     selectedMembers[0].surname,
    player_name: `${selectedMembers[0].first_name} ${selectedMembers[0].surname}`,
    group_name:  'Mon groupe',
  } : {}

  function applyPreviewVars(text: string): string {
    return Object.entries(previewVars).reduce(
      (r, [k, v]) => r.replace(new RegExp(`{{${k}}}`, 'g'), v),
      text
    )
  }

  async function handleSend() {
    if (!subject.trim()) { toast.error('Sujet manquant'); return }
    if (!body.trim())    { toast.error('Message manquant'); return }
    if (selectedIds.size === 0) { toast.error('Aucun destinataire sélectionné'); return }

    setSending(true)
    try {
      const res = await fetch('/api/send-communication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          playerIds: [...selectedIds],
          subject,
          body,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`${json.sent} email${json.sent > 1 ? 's' : ''} envoyé${json.sent > 1 ? 's' : ''}${json.skipped ? ` · ${json.skipped} ignoré(s)` : ''}`)
        if (json.errors?.length) toast.error(`Erreurs : ${json.errors.join(', ')}`)
      } else {
        toast.error(json.error ?? 'Erreur envoi')
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSending(false)
    }
  }

  if (loading) return (
    <div className="p-6 space-y-3 max-w-3xl">
      {[1,2,3].map(i => <div key={i} className="h-20 bg-white/40 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-3xl">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-black text-slate-900 tracking-tight">Communications</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Envoie un email aux membres du groupe</p>
      </div>

      <div className="flex flex-col gap-6">

        {/* ── 1. Destinataires ─────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <p className="text-[13px] font-bold text-slate-800">
              Destinataires
              {selectedIds.size > 0 && (
                <span className="ml-2 text-[11px] font-semibold text-white bg-[#185FA5] px-2 py-0.5 rounded-full">
                  {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
                </span>
              )}
            </p>
            <div className="flex gap-1">
              <button onClick={selectAll}
                className="text-[11px] font-semibold text-[#185FA5] hover:underline px-2 py-1">
                Tous
              </button>
              <button onClick={selectNone}
                className="text-[11px] font-semibold text-slate-400 hover:underline px-2 py-1">
                Aucun
              </button>
            </div>
          </div>

          {/* Filtres rapides */}
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap gap-2 items-end">
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {(['all', 'event', 'role'] as const).map(mode => (
                <button key={mode} onClick={() => setFilterMode(mode)}
                  className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                    filterMode === mode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {mode === 'all' ? 'Tous' : mode === 'event' ? 'Par événement' : 'Par rôle'}
                </button>
              ))}
            </div>

            {filterMode === 'event' && (
              <>
                <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-[12px] bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30">
                  <option value="">Choisir un événement...</option>
                  {events.map(e => (
                    <option key={e.id} value={e.id}>{e.title}</option>
                  ))}
                </select>
                <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value as ParticipantStatus)}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-[12px] bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30">
                  <option value="GOING">Confirmés (GOING)</option>
                  <option value="INVITED">Invités</option>
                  <option value="DECLINED">Déclinés</option>
                  <option value="WAITLIST">Liste d'attente</option>
                </select>
                <button onClick={applyEventFilter} disabled={!selectedEvent}
                  className="text-[12px] font-semibold px-3 py-2 rounded-xl bg-[#185FA5] text-white hover:bg-[#0C447C] disabled:opacity-40 transition-colors">
                  Appliquer
                </button>
              </>
            )}

            {filterMode === 'role' && (
              <div className="flex gap-2">
                <button onClick={() => setSelectedIds(new Set(membersWithEmail.filter(m => m.role === 'owner').map(m => m.id)))}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-xl border border-[#B5D4F4] bg-[#EBF3FC] text-[#185FA5] hover:bg-blue-100 transition-colors">
                  Admins
                </button>
                <button onClick={() => setSelectedIds(new Set(membersWithEmail.filter(m => m.role !== 'owner').map(m => m.id)))}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                  Membres
                </button>
                <button onClick={() => setSelectedIds(new Set(membersWithEmail.filter(m => m.role === 'guest').map(m => m.id)))}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
                  Visiteurs
                </button>
              </div>
            )}
          </div>

          {/* Liste membres */}
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {membersWithEmail.map(member => {
              const hasEmail   = !!member.email
              const isSelected = selectedIds.has(member.id)
              return (
                <label key={member.id}
                  className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors ${
                    !hasEmail ? 'opacity-40 cursor-not-allowed' : isSelected ? 'bg-[#EBF3FC]/50' : 'hover:bg-slate-50'
                  }`}>
                  <input type="checkbox" checked={isSelected} disabled={!hasEmail}
                    onChange={() => hasEmail && toggleMember(member.id)}
                    className="rounded border-slate-300 text-[#185FA5] focus:ring-[#185FA5]/30" />
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                    style={{
                      background: member.role === 'guest' ? '#FEF3C7' : '#EBF3FC',
                      color:      member.role === 'guest' ? '#92400E' : '#0C447C',
                    }}>
                    {member.first_name[0]}{member.surname[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-semibold text-slate-800">
                      {member.first_name} {member.surname}
                    </span>
                    {member.email
                      ? <span className="text-[11px] text-slate-400 ml-2">{member.email}</span>
                      : <span className="text-[11px] text-red-400 ml-2">Pas d'email</span>
                    }
                  </div>
                  {member.role === 'owner' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EBF3FC] text-[#185FA5]">Admin</span>
                  )}
                  {member.role === 'guest' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E]">Visiteur</span>
                  )}
                </label>
              )
            })}
          </div>
        </div>

        {/* ── 2. Template + éditeur ────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-[13px] font-bold text-slate-800 mb-3">Message</p>

            {/* Templates */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {TEMPLATES.map(tpl => (
                <button key={tpl.id} onClick={() => applyTemplate(tpl.id)}
                  className={`text-[11px] font-semibold px-3 py-1.5 rounded-xl border transition-colors ${
                    activeTemplate === tpl.id
                      ? 'bg-[#185FA5] border-[#185FA5] text-white'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                  {tpl.label}
                </button>
              ))}
            </div>

            {/* Sujet */}
            <div className="mb-3">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Sujet
              </label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Sujet de l'email..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5]"
              />
            </div>

            {/* Variables */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-400">Insérer :</span>
              {VARIABLES.map(v => (
                <button key={v.key} onClick={() => insertVariable(v.key)}
                  className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                  {v.key}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="mb-3">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Corps du message
              </label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={10}
                placeholder="Écris ton message ici..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5] resize-y font-mono leading-relaxed"
              />
            </div>

            {/* Prévisualisation */}
            {selectedMembers.length > 0 && (subject || body) && (
              <div>
                <button onClick={() => setPreview(v => !v)}
                  className="text-[12px] font-semibold text-[#185FA5] hover:underline mb-2">
                  {preview ? '▲ Masquer la prévisualisation' : '▼ Prévisualiser pour ' + selectedMembers[0].first_name}
                </button>
                {preview && (
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 text-[13px] text-slate-700 leading-relaxed">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                      Sujet : {applyPreviewVars(subject)}
                    </p>
                    <div className="whitespace-pre-wrap">{applyPreviewVars(body)}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer / Send */}
          <div className="px-5 py-4 bg-slate-50/50 flex items-center justify-between gap-4">
            <p className="text-[12px] text-slate-500">
              {selectedIds.size === 0
                ? 'Aucun destinataire sélectionné'
                : `${selectedIds.size} destinataire${selectedIds.size > 1 ? 's' : ''} · ${selectedMembers.filter(m => m.email).length} avec email`
              }
            </p>
            <button
              onClick={handleSend}
              disabled={sending || selectedIds.size === 0 || !subject.trim() || !body.trim()}
              className="flex items-center gap-2 bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-40 transition-colors">
              {sending ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Envoi...
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                  Envoyer
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
