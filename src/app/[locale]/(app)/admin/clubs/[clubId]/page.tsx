'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import ClubEditor from '@/components/clubs/ClubEditor'

const supabase = createClient()

const COUNTRIES = [
  { code: 'BE', flag: '🇧🇪' }, { code: 'FR', flag: '🇫🇷' }, { code: 'NL', flag: '🇳🇱' },
  { code: 'LU', flag: '🇱🇺' }, { code: 'DE', flag: '🇩🇪' }, { code: 'GB', flag: '🇬🇧' },
  { code: 'ES', flag: '🇪🇸' }, { code: 'PT', flag: '🇵🇹' }, { code: 'IT', flag: '🇮🇹' },
  { code: 'CH', flag: '🇨🇭' }, { code: 'OTHER', flag: '🌍' },
]

type Club = { id: string; name: string; country: string; region: string | null }

export default function ClubDetailPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations()
  const clubId = params.clubId as string

  const [club,    setClub]    = useState<Club | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => { loadClub() }, [clubId])

  async function loadClub() {
    setLoading(true)
    const { data } = await supabase.from('clubs').select('id, name, country, region').eq('id', clubId).maybeSingle()
    setClub(data)
    setLoading(false)
  }

  async function saveClubInfo(patch: Partial<Club>) {
    if (!club) return
    const updated = { ...club, ...patch }
    setClub(updated)
    setSaving(true)
    const { error } = await supabase.from('clubs').update(patch).eq('id', clubId)
    setSaving(false)
    if (error) toast.error(t('errors.generic') ?? 'Une erreur est survenue')
  }

  async function handleDeleteClub() {
    setDeleting(true)
    try {
      const { data: courseRows } = await supabase.from('courses').select('id').eq('club_id', clubId)
      const courseIds = (courseRows ?? []).map(c => c.id)

      if (courseIds.length > 0) {
        const { data: teeRows } = await supabase.from('course_tees').select('id').in('course_id', courseIds)
        const teeIds = (teeRows ?? []).map(t => t.id)
        if (teeIds.length > 0) {
          const { count } = await supabase.from('event_participants')
            .select('*', { count: 'exact', head: true }).in('tee_id', teeIds)
          if (count && count > 0) {
            toast.error(t('clubs.deleteBlockedClub', { count }))
            setConfirmingDelete(false)
            return
          }
        }
        await supabase.from('course_holes').delete().in('course_id', courseIds)
        await supabase.from('course_tees').delete().in('course_id', courseIds)
        await supabase.from('courses').delete().in('id', courseIds)
      }

      const { error } = await supabase.from('clubs').delete().eq('id', clubId)
      if (error) throw error

      toast.success(t('clubs.clubDeleted'))
      router.push('/admin/clubs')
    } catch (err) {
      toast.error(t('errors.generic') ?? 'Une erreur est survenue')
      setConfirmingDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-[13px] text-gray-400">…</div>
  }

  if (!club) {
    return (
      <div className="p-6 max-w-4xl">
        <p className="text-[13px] text-gray-500">{t('clubs.notFound')}</p>
        <button onClick={() => router.push('/admin/clubs')} className="mt-3 text-[13px] text-[#185FA5] hover:underline">
          ← {t('clubs.backToList')}
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      <button onClick={() => router.push('/admin/clubs')} className="text-[12px] text-gray-900 hover:text-[#185FA5] mb-3 inline-flex items-center gap-1 font-medium">
        ← {t('clubs.backToList')}
      </button>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          value={club.name}
          onChange={e => setClub({ ...club, name: e.target.value })}
          onBlur={() => saveClubInfo({ name: club.name })}
          className="text-[20px] font-bold text-gray-900 border-b border-transparent hover:border-gray-200 focus:border-[#185FA5] focus:outline-none px-0.5 bg-transparent"
        />
        <select
          value={club.country}
          onChange={e => saveClubInfo({ country: e.target.value })}
          className="border border-gray-200 rounded-md px-2 py-1 text-[12px] bg-white focus:outline-none focus:border-blue-300"
        >
          {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
        </select>
        <input
          value={club.region ?? ''}
          onChange={e => setClub({ ...club, region: e.target.value })}
          onBlur={() => saveClubInfo({ region: club.region?.trim() || null })}
          placeholder={t('clubs.regionPlaceholder')}
          className="border border-gray-200 rounded-md px-2 py-1 text-[12px] bg-white focus:outline-none focus:border-blue-300 w-40"
        />
        {saving && <span className="text-[11px] text-gray-400">{t('clubs.saving')}</span>}

        <div className="ml-auto flex items-center gap-2">
          {confirmingDelete ? (
            <>
              <span className="text-[12px] text-red-600">{t('clubs.confirmDeleteClub')}</span>
              <button onClick={handleDeleteClub} disabled={deleting}
                className="text-[12px] font-semibold text-red-600 hover:text-red-700 px-2 disabled:opacity-50">
                {deleting ? t('clubs.saving') : t('clubs.confirmDelete')}
              </button>
              <button onClick={() => setConfirmingDelete(false)}
                className="text-[13px] text-gray-400 hover:text-gray-600 px-1">
                ✕
              </button>
            </>
          ) : (
            <button onClick={() => setConfirmingDelete(true)} title={t('clubs.deleteClub')}
              className="text-red-400 hover:text-red-600 text-[15px] px-1">
              🗑
            </button>
          )}
        </div>
      </div>

      <ClubEditor clubId={clubId} />
    </div>
  )
}
