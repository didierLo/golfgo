'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const supabase = createClient()

type PlayerRow = {
  surname: string
  first_name: string
  whs: string
  federal_no: string
  email: string
  phone: string
  home_club: string
}

type Props = {
  isOpen: boolean
  onClose: () => void
}

const emptyRow: PlayerRow = {
  surname: '', first_name: '', whs: '',
  federal_no: '', email: '', phone: '', home_club: '',
}

const cellClass = "w-full border border-gray-200 rounded px-2 py-1.5 text-[12px] focus:outline-none focus:border-blue-300"

export default function BulkAddPlayersModal({ isOpen, onClose }: Props) {
  const [listRows, setListRows] = useState<PlayerRow[]>([{ ...emptyRow }])
  const [loading, setLoading] = useState(false)

  function addRow() {
    setListRows(prev => [...prev, { ...emptyRow }])
  }

  function removeRow(index: number) {
    if (listRows.length > 1) setListRows(prev => prev.filter((_, i) => i !== index))
  }

  function updateRow(index: number, field: keyof PlayerRow, value: string) {
    setListRows(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  async function handleBulkInsert() {
    setLoading(true)
    try {
      const players = listRows
        .filter(row => row.surname.trim() && row.first_name.trim())
        .map(row => ({
          surname:    row.surname.trim(),
          first_name: row.first_name.trim(),
          whs:        row.whs ? parseFloat(row.whs.replace(',', '.')) : null,
          federal_no: row.federal_no.trim().toUpperCase(),
          email:      row.email.trim() || null,
          phone:      row.phone.trim() || null,
          home_club:  row.home_club.trim() || null,
        }))

      if (players.length === 0) { toast.error('Aucun joueur valide'); setLoading(false); return }

      const { error } = await supabase
        .from('players')
        .upsert(players, { onConflict: 'federal_no' })

      if (error) { toast.error(error.message); setLoading(false); return }

      toast.success(`${players.length} joueur(s) ajouté(s)`)
      setListRows([{ ...emptyRow }])
      onClose()
      window.location.reload()
    } catch (err) {
      toast.error('Erreur inattendue')
    }
    setLoading(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-gray-200 w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[16px] font-medium text-gray-900">Ajouter depuis une liste</h2>
            <p className="text-[12px] text-gray-400 mt-0.5">Remplis les lignes puis clique sur "Ajouter"</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-[12px]" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="border-b border-gray-200">
                {['Nom *', 'Prénom *', 'N° fédéral', 'WHS', 'Email', 'Téléphone', 'Club', ''].map((h, i) => (
                  <th key={i} className="px-2 py-2 text-left text-[11px] font-medium text-gray-400"
                    style={{ width: i === 7 ? '32px' : 'auto' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listRows.map((row, index) => (
                <tr key={index} className="border-b border-gray-100">
                  <td className="px-1 py-1.5">
                    <input value={row.surname} onChange={e => updateRow(index, 'surname', e.target.value)}
                      placeholder="Dupont" className={cellClass} />
                  </td>
                  <td className="px-1 py-1.5">
                    <input value={row.first_name} onChange={e => updateRow(index, 'first_name', e.target.value)}
                      placeholder="Jean" className={cellClass} />
                  </td>
                  <td className="px-1 py-1.5">
                    <input value={row.federal_no} onChange={e => updateRow(index, 'federal_no', e.target.value)}
                      placeholder="123456" className={cellClass} />
                  </td>
                  <td className="px-1 py-1.5">
                    <input value={row.whs} onChange={e => updateRow(index, 'whs', e.target.value)}
                      placeholder="18.4" className={cellClass} />
                  </td>
                  <td className="px-1 py-1.5">
                    <input value={row.email} onChange={e => updateRow(index, 'email', e.target.value)}
                      placeholder="jean@..." className={cellClass} />
                  </td>
                  <td className="px-1 py-1.5">
                    <input value={row.phone} onChange={e => updateRow(index, 'phone', e.target.value)}
                      placeholder="+32..." className={cellClass} />
                  </td>
                  <td className="px-1 py-1.5">
                    <input value={row.home_club} onChange={e => updateRow(index, 'home_club', e.target.value)}
                      placeholder="GC LLN" className={cellClass} />
                  </td>
                  <td className="px-1 py-1.5 text-center">
                    <button onClick={() => removeRow(index)}
                      className="text-red-400 hover:text-red-600 transition-colors text-[16px] leading-none">
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button onClick={addRow}
            className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-dashed border-gray-300 text-gray-500 hover:border-[#185FA5] hover:text-[#185FA5] transition-colors">
            + Ajouter une ligne
          </button>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="text-[12px] font-medium px-4 py-2 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
              Annuler
            </button>
            <button onClick={handleBulkInsert} disabled={loading}
              className="text-[12px] font-medium px-4 py-2 rounded-md bg-[#185FA5] text-white hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
              {loading ? 'Ajout…' : `Ajouter ${listRows.filter(r => r.surname.trim() && r.first_name.trim()).length} joueur(s)`}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
