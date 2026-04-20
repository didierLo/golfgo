'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BulkAddPlayersModal from '@/components/players/BulkAddPlayersModal'
import ImportPlayers from '@/components/players/ImportPlayers'

const supabase = createClient()
const inputClass = "w-full border border-white/60 rounded-xl px-3 py-2.5 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5] bg-white/70 backdrop-blur-sm"

const TEE_OPTIONS = [
  { value: 'yellow', label: 'Yellow', color: '#EF9F27' },
  { value: 'red',    label: 'Red',    color: '#E24B4A' },
  { value: 'white',  label: 'White',  color: '#B4B2A9' },
  { value: 'blue',   label: 'Blue',   color: '#378ADD' },
]

type Player   = { id: string; first_name: string; surname: string; federal_no: string | null; whs: number | null }
type Gender   = 'M' | 'F'
type TeeColor = 'yellow' | 'red' | 'white' | 'blue'
type Role     = 'member' | 'guest'

export default function AddMemberPage() {
  const params  = useParams()
  const groupId = params.id as string

  const [search, setSearch]                   = useState('')
  const [results, setResults]                 = useState<Player[]>([])
  const [loadingKey, setLoadingKey]           = useState<string | null>(null)
  const [added, setAdded]                     = useState<Record<string, Role>>({})
  const [isListModalOpen, setIsListModalOpen] = useState(false)
  const [showImport, setShowImport]           = useState(false)
  const [showCreate, setShowCreate]           = useState(false)
  const [form, setForm] = useState({
    first_name: '', surname: '', federal_no: '', whs: '', email: '', phone: '',
    gender: 'M' as Gender, default_tee_color: 'yellow' as TeeColor,
  })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [guestMode, setGuestMode] = useState(false)

  useEffect(() => {
    if (search.length < 2) { setResults([]); return }
    searchPlayers()
  }, [search])

  async function searchPlayers() {
    const { data } = await supabase.from('players').select('id, first_name, surname, federal_no, whs')
      .or(`federal_no.ilike.%${search}%,first_name.ilike.%${search}%,surname.ilike.%${search}%`).limit(10)
    setResults(data || [])
  }

  async function addExisting(playerId: string, role: Role) {
    const key = `${playerId}-${role}`
    setLoadingKey(key)

    // Vérifier si déjà dans le groupe
    const { data: existing } = await supabase.from('groups_players')
      .select('id, role').eq('group_id', groupId).eq('player_id', playerId).maybeSingle()

    let err: any = null
    if (existing) {
      if (existing.role === role) {
        alert(`Ce joueur est déjà dans ce groupe comme ${role === 'guest' ? 'visiteur' : 'membre'}`)
        setLoadingKey(null)
        return
      }
      // Rôle différent → mettre à jour
      const { error } = await supabase.from('groups_players').update({ role }).eq('id', existing.id)
      err = error
    } else {
      const { error } = await supabase.from('groups_players').insert({ group_id: groupId, player_id: playerId, role })
      err = error
    }

    if (err) { alert(err.message); setLoadingKey(null); return }
    setAdded(prev => ({ ...prev, [playerId]: role }))
    setSearch('')
    setResults([])
    setLoadingKey(null)
  }

  function setGender(gender: Gender) {
    setForm(f => ({ ...f, gender, default_tee_color: gender === 'M' ? 'yellow' : 'red' }))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.surname.trim() || !form.first_name.trim()) { setError('Nom et prénom requis'); return }
    if (!guestMode && !form.federal_no.trim()) { setError('Numéro fédéral obligatoire'); return }
    setSaving(true); setError(''); setSearch(''); setResults([])

    if (!guestMode && form.federal_no.trim()) {
      const federal = form.federal_no.trim().toUpperCase()
      const { data: existing } = await supabase.from('players').select('id').eq('federal_no', federal).maybeSingle()
      if (existing) { await addExisting(existing.id, 'member'); setShowCreate(false); setSaving(false); return }
    }

    const federal = form.federal_no.trim() ? form.federal_no.trim().toUpperCase() : null

    const { data: player, error: playerError } = await supabase.from('players').insert({
      first_name: form.first_name.trim(), surname: form.surname.trim(),
      federal_no: federal,
      whs: form.whs ? parseFloat(form.whs.replace(',', '.')) : null,
      email: form.email.trim() || null, phone: form.phone.trim() || null,
      gender: form.gender, default_tee_color: form.default_tee_color,
    }).select('id').single()

    if (playerError || !player) { setError(playerError?.message ?? 'Erreur création joueur'); setSaving(false); return }

    const role: Role = guestMode ? 'guest' : 'member'
    const { error: gpError } = await supabase.from('groups_players').insert({ group_id: groupId, player_id: player.id, role })
    if (gpError) { setError(gpError.message); setSaving(false); return }

    setAdded(prev => ({ ...prev, [player.id]: role }))
    setShowCreate(false)
    setForm({ first_name: '', surname: '', federal_no: '', whs: '', email: '', phone: '', gender: 'M', default_tee_color: 'yellow' })
    setSaving(false)
  }

  const addedCount = Object.keys(added).length

  return (
    <div className="p-5 sm:p-6 max-w-xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">Ajouter un membre</h1>
          <p className="text-[13px] text-slate-600 mt-0.5">Recherche un joueur existant ou crée-en un nouveau</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsListModalOpen(true)}
            className="text-[12px] font-semibold px-3 py-2 rounded-xl border border-white/50 text-slate-600 hover:bg-white/30 transition-colors">
            Depuis une liste
          </button>
          <button onClick={() => setShowImport(true)}
            className="text-[12px] font-semibold px-3 py-2 rounded-xl border border-white/50 text-slate-600 hover:bg-white/30 transition-colors">
            Importer XLS
          </button>
        </div>
      </div>

      {/* Confirmation */}
      {addedCount > 0 && (
        <div className="mb-4 px-4 py-3 bg-[#EAF3DE] border border-[#C0DD97] rounded-xl text-[12px] font-semibold text-[#3B6D11]">
          ✓ {addedCount} membre{addedCount > 1 ? 's' : ''} ajouté{addedCount > 1 ? 's' : ''} au groupe
        </div>
      )}

      {/* Recherche */}
      <div className="mb-4">
        <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Rechercher par nom ou n° fédéral</label>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ex: Dupont ou 123456" className={inputClass} autoFocus />
      </div>

      {/* Résultats */}
      {results.length > 0 && (
        <div className="rounded-xl border border-white/60 shadow-sm overflow-hidden mb-4"
          style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
          {results.map((p, i) => {
            const addedRole = added[p.id]
            return (
              <div key={p.id} className={`flex items-center gap-3 px-4 py-3 ${i < results.length - 1 ? 'border-b border-white/30' : ''}`}>
                <div className="w-8 h-8 rounded-full bg-[#EBF3FC] flex items-center justify-center text-[11px] font-bold text-[#0C447C] flex-shrink-0">
                  {p.first_name[0]}{p.surname[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-slate-900">{p.first_name} {p.surname}</div>
                  <div className="text-[11px] text-slate-500">
                    {p.federal_no && `Fédéral ${p.federal_no}`}{p.whs != null && ` · WHS ${p.whs}`}
                  </div>
                </div>

                {addedRole ? (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                    style={addedRole === 'guest'
                      ? { background: '#FEF3C7', color: '#92400E' }
                      : { background: '#EAF3DE', color: '#3B6D11' }}>
                    ✓ {addedRole === 'guest' ? 'Visiteur' : 'Membre'}
                  </span>
                ) : (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => addExisting(p.id, 'member')}
                      disabled={loadingKey === `${p.id}-member`}
                      className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-[#185FA5] text-[#185FA5] bg-white hover:bg-[#EBF3FC] disabled:opacity-50 transition-colors whitespace-nowrap">
                      {loadingKey === `${p.id}-member` ? '…' : 'Membre'}
                    </button>
                    <button
                      onClick={() => addExisting(p.id, 'guest')}
                      disabled={loadingKey === `${p.id}-guest`}
                      className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-amber-400 text-amber-700 bg-white hover:bg-amber-50 disabled:opacity-50 transition-colors whitespace-nowrap">
                      {loadingKey === `${p.id}-guest` ? '…' : 'Visiteur'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Aucun résultat */}
      {search.length >= 2 && results.length === 0 && !showCreate && (
        <div className="text-center py-6 text-[13px] text-slate-500 border border-dashed border-slate-200 rounded-xl mb-4">
          Aucun joueur trouvé pour "{search}"
        </div>
      )}

      {/* Boutons créer */}
      {!showCreate && (
        <div className="flex flex-col gap-2">
          <button onClick={() => { setShowCreate(true); setGuestMode(false); const parts = search.trim().split(' '); if (parts.length >= 2) setForm(f => ({ ...f, first_name: parts[0], surname: parts.slice(1).join(' ') })) }}
            className="w-full text-[13px] font-semibold py-3 rounded-xl border border-dashed border-slate-300 text-slate-500 hover:border-[#185FA5] hover:text-[#185FA5] transition-colors">
            + Créer un nouveau joueur
          </button>
          <button onClick={() => { setShowCreate(true); setGuestMode(true); const parts = search.trim().split(' '); if (parts.length >= 2) setForm(f => ({ ...f, first_name: parts[0], surname: parts.slice(1).join(' ') })) }}
            className="w-full text-[13px] font-semibold py-3 rounded-xl border border-dashed border-amber-300 text-amber-600 hover:border-amber-500 hover:bg-amber-50/50 transition-colors">
            + Ajouter un visiteur <span className="text-[11px] font-normal text-amber-400">(sans compte, sans n° fédéral)</span>
          </button>
        </div>
      )}

      {/* Formulaire création */}
      {showCreate && (
        <div className="border border-white/50 rounded-xl p-5 mt-2 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-black text-slate-900">{guestMode ? 'Nouveau visiteur' : 'Nouveau joueur'}</p>
              {guestMode && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#92400E' }}>
                  Visiteur
                </span>
              )}
            </div>
            <button onClick={() => { setShowCreate(false); setError('') }} className="text-[12px] font-semibold text-slate-400 hover:text-slate-600">Annuler</button>
          </div>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Prénom *</label>
                <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} required placeholder="Jean" className={inputClass} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Nom *</label>
                <input value={form.surname} onChange={e => setForm(f => ({ ...f, surname: e.target.value }))} required placeholder="Dupont" className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
                  N° fédéral {guestMode ? <span className="text-slate-400 font-normal">— optionnel</span> : '*'}
                </label>
                <input value={form.federal_no} onChange={e => setForm(f => ({ ...f, federal_no: e.target.value }))}
                  required={!guestMode} placeholder={guestMode ? 'Optionnel' : '123456'} className={inputClass} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">WHS</label>
                <input value={form.whs} onChange={e => setForm(f => ({ ...f, whs: e.target.value }))} placeholder="18.4" className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jean@example.com" className={inputClass} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Téléphone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+32 ..." className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Genre & tee de départ par défaut</label>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                  {(['M', 'F'] as const).map(g => (
                    <button key={g} type="button" onClick={() => setGender(g)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${form.gender === g ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                      {g === 'M' ? 'Homme' : 'Femme'}
                    </button>
                  ))}
                </div>
                <span className="text-slate-300 text-[12px]">→</span>
                <div className="flex gap-1.5">
                  {TEE_OPTIONS.map(t => (
                    <button key={t.value} type="button" onClick={() => setForm(f => ({ ...f, default_tee_color: t.value as TeeColor }))}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[12px] font-semibold transition-colors ${
                        form.default_tee_color === t.value ? 'border-slate-400 bg-white shadow-sm text-slate-700' : 'border-slate-200 text-slate-400 hover:border-slate-300'
                      }`}>
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.color }} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Homme → Yellow · Femme → Red · modifiable par event</p>
            </div>
            {error && <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>}
            <button type="submit" disabled={saving}
              className="bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
              {saving ? 'Création…' : guestMode ? 'Ajouter comme visiteur' : 'Créer et ajouter au groupe'}
            </button>
          </form>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
        <a href={`/groups/${groupId}/members`} className="text-[13px] font-medium text-slate-500 hover:text-slate-700 transition-colors">← Retour aux membres</a>
        {addedCount > 0 && <a href={`/groups/${groupId}/events`} className="text-[13px] font-semibold text-[#185FA5] hover:underline">Continuer vers les événements →</a>}
      </div>

      <BulkAddPlayersModal isOpen={isListModalOpen} onClose={() => setIsListModalOpen(false)} />

      {showImport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-[500px] space-y-4 border border-white/50">
            <div className="flex justify-between items-center">
              <h2 className="text-[15px] font-black text-slate-900">Importer des joueurs</h2>
              <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-slate-600">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            <ImportPlayers />
          </div>
        </div>
      )}
    </div>
  )
}
