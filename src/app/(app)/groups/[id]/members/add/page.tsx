'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BulkAddPlayersModal from '@/components/players/BulkAddPlayersModal'
import ImportPlayers from '@/components/players/ImportPlayers'

const supabase = createClient()

const inputClass = "w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] placeholder-gray-300 focus:outline-none focus:border-blue-300"

const TEE_OPTIONS = [
  { value: 'yellow', label: 'Yellow', color: '#EF9F27' },
  { value: 'red',    label: 'Red',    color: '#E24B4A' },
  { value: 'white',  label: 'White',  color: '#B4B2A9' },
  { value: 'blue',   label: 'Blue',   color: '#378ADD' },
]

type Player = {
  id: string
  first_name: string
  surname: string
  federal_no: string | null
  whs: number | null
}

type Gender = 'M' | 'F'
type TeeColor = 'yellow' | 'red' | 'white' | 'blue'

export default function AddMemberPage() {
  const params = useParams()
  const groupId = params.id as string

  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Player[]>([])
  const [loading, setLoading] = useState(false)
  const [added, setAdded] = useState<string[]>([])

  const [isListModalOpen, setIsListModalOpen] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    first_name: '', surname: '', federal_no: '',
    whs: '', email: '', phone: '',
    gender: 'M' as Gender,
    default_tee_color: 'yellow' as TeeColor,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (search.length < 2) { setResults([]); return }
    searchPlayers()
  }, [search])

  async function searchPlayers() {
    const { data } = await supabase
      .from('players')
      .select('id, first_name, surname, federal_no, whs')
      .or(`federal_no.ilike.%${search}%,first_name.ilike.%${search}%,surname.ilike.%${search}%`)
      .limit(10)
    setResults(data || [])
  }

 async function addExisting(playerId: string) {
  setLoading(true)
  const { error } = await supabase
    .from('groups_players')
    .insert({ group_id: groupId, player_id: playerId })
  if (error) {
    alert(error.message.includes('duplicate') ? 'Ce joueur est déjà dans ce groupe' : error.message)
    setLoading(false)
    return
  }
  setAdded(prev => [...prev, playerId])
  setSearch('')
  setResults([])
  setLoading(false)
}

  function setGender(gender: Gender) {
    setForm(f => ({
      ...f,
      gender,
      default_tee_color: gender === 'M' ? 'yellow' : 'red',
    }))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.surname.trim() || !form.first_name.trim()) { setError('Nom et prénom requis'); return }
    if (!form.federal_no.trim()) { setError('Numéro fédéral obligatoire'); return }

    setSaving(true)
    setError('')
    setSearch('')
    setResults([])


    const federal = form.federal_no.trim().toUpperCase()
    const { data: existing } = await supabase
      .from('players').select('id').eq('federal_no', federal).maybeSingle()

    if (existing) {
      await addExisting(existing.id)
      setShowCreate(false)
      setSaving(false)
      return
    }

    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({
        first_name: form.first_name.trim(),
        surname: form.surname.trim(),
        federal_no: federal,
        whs: form.whs ? parseFloat(form.whs.replace(',', '.')) : null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        gender: form.gender,
        default_tee_color: form.default_tee_color,
      })
      .select('id').single()

    if (playerError || !player) {
      setError(playerError?.message ?? 'Erreur création joueur')
      setSaving(false)
      return
    }

    const { error: gpError } = await supabase
      .from('groups_players')
      .insert({ group_id: groupId, player_id: player.id })

    if (gpError) { setError(gpError.message); setSaving(false); return }

    setAdded(prev => [...prev, player.id])
    setShowCreate(false)
    setForm({ first_name: '', surname: '', federal_no: '', whs: '', email: '', phone: '', gender: 'M', default_tee_color: 'yellow' })
    setSaving(false)
  }

  return (
    <div className="p-6 max-w-xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[18px] font-medium text-gray-900">Ajouter un membre</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">Recherche un joueur existant ou crée-en un nouveau</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsListModalOpen(true)}
            className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            Depuis une liste
          </button>
          <button onClick={() => setShowImport(true)}
            className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            Importer XLS
          </button>
        </div>
      </div>

      {/* Confirmation */}
      {added.length > 0 && (
        <div className="mb-4 px-3 py-2 bg-green-50 border border-green-200 rounded-md text-[12px] text-green-700">
          {added.length} membre{added.length > 1 ? 's' : ''} ajouté{added.length > 1 ? 's' : ''} au groupe
        </div>
      )}

      {/* Recherche */}
      <div className="mb-4">
        <label className="block text-[12px] font-medium text-gray-500 mb-1.5">
          Rechercher par nom ou n° fédéral
        </label>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Ex: Dupont ou 123456" className={inputClass} autoFocus />
      </div>

      {/* Résultats */}
      {results.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
          {results.map((p, i) => {
            const isAdded = added.includes(p.id)
            return (
              <div key={p.id}
                className={`flex items-center gap-3 px-4 py-3 ${i < results.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <div className="w-8 h-8 rounded-full bg-[#E6F1FB] flex items-center justify-center text-[11px] font-medium text-[#0C447C] flex-shrink-0">
                  {p.first_name[0]}{p.surname[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-gray-900">{p.first_name} {p.surname}</div>
                  <div className="text-[11px] text-gray-400">
                    {p.federal_no && `Fédéral ${p.federal_no}`}{p.whs && ` · WHS ${p.whs}`}
                  </div>
                </div>
                <button onClick={() => addExisting(p.id)} disabled={loading || isAdded}
                  className={`text-[12px] font-medium px-3 py-1.5 rounded-md border transition-colors ${
                    isAdded
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-[#185FA5] border-[#185FA5] text-white hover:bg-[#0C447C]'
                  }`}>
                  {isAdded ? '✓ Ajouté' : 'Ajouter'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Aucun résultat */}
      {search.length >= 2 && results.length === 0 && !showCreate && (
        <div className="text-center py-6 text-[13px] text-gray-400 border border-dashed border-gray-200 rounded-lg mb-4">
          Aucun joueur trouvé pour "{search}"
        </div>
      )}

      {/* Bouton créer */}
      {!showCreate && (
        <button
          onClick={() => {
            setShowCreate(true)
            const parts = search.trim().split(' ')
            if (parts.length >= 2) {
              setForm(f => ({ ...f, first_name: parts[0], surname: parts.slice(1).join(' ') }))
            }
          }}
          className="w-full text-[13px] font-medium py-2.5 rounded-md border border-dashed border-gray-300 text-gray-500 hover:border-[#185FA5] hover:text-[#185FA5] transition-colors">
          + Créer un nouveau joueur
        </button>
      )}

      {/* Formulaire création */}
      {showCreate && (
        <div className="border border-gray-200 rounded-lg p-4 mt-2">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-medium text-gray-700">Nouveau joueur</p>
            <button onClick={() => { setShowCreate(false); setError('') }}
              className="text-[12px] text-gray-400 hover:text-gray-600">Annuler</button>
          </div>

          <form onSubmit={handleCreate} className="flex flex-col gap-3">

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-gray-500 mb-1.5">Prénom *</label>
                <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                  required placeholder="Jean" className={inputClass} />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-500 mb-1.5">Nom *</label>
                <input value={form.surname} onChange={e => setForm(f => ({ ...f, surname: e.target.value }))}
                  required placeholder="Dupont" className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-gray-500 mb-1.5">N° fédéral *</label>
                <input value={form.federal_no} onChange={e => setForm(f => ({ ...f, federal_no: e.target.value }))}
                  required placeholder="123456" className={inputClass} />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-500 mb-1.5">WHS</label>
                <input value={form.whs} onChange={e => setForm(f => ({ ...f, whs: e.target.value }))}
                  placeholder="18.4" className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-gray-500 mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="jean@example.com" className={inputClass} />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-500 mb-1.5">Téléphone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+32 ..." className={inputClass} />
              </div>
            </div>

            {/* Genre + Tee */}
            <div>
              <label className="block text-[12px] font-medium text-gray-500 mb-1.5">
                Genre & tee de départ par défaut
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-1 p-0.5 bg-gray-100 rounded-md">
                  {(['M', 'F'] as const).map(g => (
                    <button key={g} type="button" onClick={() => setGender(g)}
                      className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                        form.gender === g ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                      }`}>
                      {g === 'M' ? 'Homme' : 'Femme'}
                    </button>
                  ))}
                </div>
                <span className="text-gray-300 text-[12px]">→</span>
                <div className="flex gap-1.5">
                  {TEE_OPTIONS.map(t => (
                    <button key={t.value} type="button"
                      onClick={() => setForm(f => ({ ...f, default_tee_color: t.value as TeeColor }))}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[12px] font-medium transition-colors ${
                        form.default_tee_color === t.value
                          ? 'border-gray-400 bg-white shadow-sm text-gray-700'
                          : 'border-gray-200 text-gray-400 hover:border-gray-300'
                      }`}>
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.color }} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Homme → Yellow · Femme → Red · modifiable par event
              </p>
            </div>

            {error && (
              <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <button type="submit" disabled={saving}
              className="bg-[#185FA5] text-white text-[13px] font-medium px-5 py-2 rounded-md hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
              {saving ? 'Création…' : 'Créer et ajouter au groupe'}
            </button>

          </form>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
        <a href={`/groups/${groupId}/members`}
          className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors">
          ← Retour aux membres
        </a>
        {added.length > 0 && (
          <a href={`/groups/${groupId}/events`}
            className="text-[13px] font-medium text-[#185FA5] hover:underline">
            Continuer vers les événements →
          </a>
        )}
      </div>

      {/* Modal liste */}
      <BulkAddPlayersModal isOpen={isListModalOpen} onClose={() => setIsListModalOpen(false)} />

      {/* Modal import */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[500px] space-y-4 border border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-[15px] font-medium text-gray-900">Importer des joueurs</h2>
              <button onClick={() => setShowImport(false)} className="text-gray-400 hover:text-gray-600">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <ImportPlayers />
          </div>
        </div>
      )}

    </div>
  )
}
