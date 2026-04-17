'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const supabase = createClient()

type PlayerRow = { surname: string; first_name: string; whs: string; federal_no: string; email: string; phone: string; home_club: string }
type Props = { isOpen: boolean; onClose: () => void }

const emptyRow: PlayerRow = { surname: '', first_name: '', whs: '', federal_no: '', email: '', phone: '', home_club: '' }
const cellClass = "w-full border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-[#185FA5]/30 focus:border-[#185FA5] bg-white"

export default function BulkAddPlayersModal({ isOpen, onClose }: Props) {
  const [listRows, setListRows] = useState<PlayerRow[]>([{ ...emptyRow }])
  const [loading, setLoading] = useState(false)

  function addRow() { setListRows(prev => [...prev, { ...emptyRow }]) }
  function removeRow(index: number) { if (listRows.length > 1) setListRows(prev => prev.filter((_, i) => i !== index)) }
  function updateRow(index: number, field: keyof PlayerRow, value: string) {
    setListRows(prev => { const u = [...prev]; u[index] = { ...u[index], [field]: value }; return u })
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
      const { error } = await supabase.from('players').upsert(players, { onConflict: 'federal_no' })
      if (error) { toast.error(error.message); setLoading(false); return }
      toast.success(`${players.length} joueur(s) ajouté(s)`)
      setListRows([{ ...emptyRow }])
      onClose()
      window.location.reload()
    } catch { toast.error('Erreur inattendue') }
    setLoading(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6">

        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[16px] font-black text-slate-900">Ajouter depuis une liste</h2>
            <p className="text-[12px] text-slate-500 mt-0.5">Remplis les lignes puis clique sur "Ajouter"</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="overflow-x-auto mb-4">
          <table className="w-full text-[12px]" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="border-b border-slate-100">
                {['Nom *', 'Prénom *', 'N° fédéral', 'WHS', 'Email', 'Téléphone', 'Club', ''].map((h, i) => (
                  <th key={i} className="px-2 py-2 text-left text-[11px] font-semibold text-slate-500"
                    style={{ width: i === 7 ? '32px' : 'auto' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listRows.map((row, index) => (
                <tr key={index} className="border-b border-slate-50">
                  {(['surname', 'first_name', 'federal_no', 'whs', 'email', 'phone', 'home_club'] as const).map((field, fi) => (
                    <td key={field} className="px-1 py-1.5">
                      <input value={row[field]} onChange={e => updateRow(index, field, e.target.value)}
                        placeholder={['Dupont', 'Jean', '123456', '18.4', 'jean@...', '+32...', 'GC LLN'][fi]}
                        className={cellClass} />
                    </td>
                  ))}
                  <td className="px-1 py-1.5 text-center">
                    <button onClick={() => removeRow(index)} className="text-red-400 hover:text-red-600 transition-colors text-[16px] leading-none">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <button onClick={addRow}
            className="text-[12px] font-semibold px-3 py-1.5 rounded-xl border border-dashed border-slate-300 text-slate-500 hover:border-[#185FA5] hover:text-[#185FA5] transition-colors">
            + Ajouter une ligne
          </button>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="text-[12px] font-semibold px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
              Annuler
            </button>
            <button onClick={handleBulkInsert} disabled={loading}
              className="text-[12px] font-semibold px-4 py-2 rounded-xl bg-[#185FA5] text-white hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
              {loading ? 'Ajout…' : `Ajouter ${listRows.filter(r => r.surname.trim() && r.first_name.trim()).length} joueur(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
