'use client'

// Fenêtre « Accueillir un nouveau membre » (page Membres, organisateur) :
//  - QR code + lien vers la page d'inscription
//  - marche à suivre : créer son compte avec l'adresse e-mail enregistrée par l'organisateur
//    (le compte est alors relié automatiquement à sa fiche joueur, donc au groupe)
//  - installation de l'application sur l'écran d'accueil (iPhone / Android)
//  - impression d'une fiche à remettre en main propre
//  - envoi de ces instructions par e-mail aux membres qui n'ont pas encore de compte

import { useEffect, useMemo, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import * as Sentry from '@sentry/nextjs'

const supabase = createClient()

type Pending = { id: string; first_name: string; surname: string; email: string }

function qrSrc(url: string, size: number) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(url)}`
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export default function WelcomeNewMemberModal({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const t      = useTranslations()
  const locale = useLocale()

  const [groupName, setGroupName] = useState('')
  const [pending,   setPending]   = useState<Pending[]>([])
  const [selected,  setSelected]  = useState<Set<string>>(new Set())
  const [loading,   setLoading]   = useState(true)
  const [copied,    setCopied]    = useState(false)
  const [sending,   setSending]   = useState(false)
  const [result,    setResult]    = useState<{ ok: boolean; msg: string } | null>(null)

  const signupUrl = useMemo(
    () => (typeof window !== 'undefined' ? `${window.location.origin}/${locale}/signup` : ''),
    [locale],
  )

  useEffect(() => {
    (async () => {
      const [{ data: g }, { data: rows }] = await Promise.all([
        supabase.from('groups').select('name').eq('id', groupId).single(),
        supabase.from('groups_players')
          .select('player:players(id, first_name, surname, email, user_id)')
          .eq('group_id', groupId),
      ])
      setGroupName(g?.name ?? '')
      const list: Pending[] = (rows ?? [])
        .map((r: any) => r.player)
        .filter((p: any) => p && !p.user_id && p.email && String(p.email).includes('@'))
        .map((p: any) => ({ id: p.id, first_name: p.first_name ?? '', surname: p.surname ?? '', email: p.email }))
        .sort((a: Pending, b: Pending) => a.surname.localeCompare(b.surname, locale, { sensitivity: 'base' }))
      setPending(list)
      setLoading(false)
    })()
  }, [groupId, locale])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(signupUrl)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch { /* presse-papiers indisponible : le lien reste visible et sélectionnable */ }
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function printSheet() {
    const w = window.open('', '_blank')
    if (!w) return
    const g = escapeHtml(groupName)
    w.document.write(`<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8" />
<title>${escapeHtml(t('members.welcome.printHeading'))}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0F172A;max-width:640px;margin:32px auto;padding:0 24px;}
  h1{font-size:28px;margin:0 0 4px;} .group{font-size:20px;font-weight:700;color:#185FA5;margin:0 0 24px;}
  .qr{text-align:center;margin:12px 0 8px;} .url{text-align:center;font-size:14px;color:#475569;margin-bottom:28px;word-break:break-all;}
  ol{font-size:18px;line-height:1.6;padding-left:24px;} li{margin-bottom:14px;}
  .dev{font-size:16px;color:#334155;margin:6px 0 0;} .foot{margin-top:32px;font-size:12px;color:#94A3B8;text-align:center;}
  @media print { body{margin:0 auto;} }
</style></head><body>
<h1>${escapeHtml(t('members.welcome.printHeading'))}</h1>
<p class="group">${g}</p>
<div class="qr"><img src="${qrSrc(signupUrl, 260)}" width="260" height="260" alt="QR code" /></div>
<p class="url">${escapeHtml(signupUrl)}</p>
<ol>
  <li>${escapeHtml(t('members.welcome.step1'))}</li>
  <li>${escapeHtml(t('members.welcome.step2'))}</li>
  <li>${escapeHtml(t('members.welcome.step3'))}
    <p class="dev">🍎 ${escapeHtml(t('members.welcome.iphone'))}</p>
    <p class="dev">🤖 ${escapeHtml(t('members.welcome.android'))}</p>
  </li>
</ol>
<p class="foot">golfgo.be</p>
<script>window.onload = function(){ setTimeout(function(){ window.print() }, 400) }</script>
</body></html>`)
    w.document.close()
  }

  async function sendEmails() {
    if (selected.size === 0) return
    setSending(true); setResult(null)
    try {
      const res  = await fetch('/api/send-group-welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, playerIds: Array.from(selected) }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`)
      setResult({ ok: true, msg: t('members.welcome.sent', { count: (json.sent ?? 0) + (json.queued ?? 0) }) })
      setSelected(new Set())
    } catch (e) {
      console.error('send-group-welcome error', e)
      Sentry.captureException(e)
      setResult({ ok: false, msg: t('members.welcome.sendError') })
    } finally { setSending(false) }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 relative">
        <button onClick={onClose} aria-label={t('members.welcome.close')}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-[18px] leading-none">✕</button>

        <h2 className="text-[17px] font-bold text-slate-900 mb-1 pr-6">{t('members.welcome.title')}</h2>
        <p className="text-[12px] text-slate-500 mb-5 leading-relaxed">{t('members.welcome.howTo')}</p>

        {/* QR + lien */}
        <div className="flex justify-center mb-3">
          {signupUrl && (
            <img src={qrSrc(signupUrl, 180)} alt="QR code" width={180} height={180}
              className="rounded-xl border border-slate-100" />
          )}
        </div>
        <div className="bg-slate-50 rounded-xl px-3 py-2.5 mb-5 flex items-center gap-2">
          <span className="text-[11px] text-slate-600 truncate flex-1 select-all">{signupUrl}</span>
          <button onClick={copyLink}
            className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#185FA5] text-white hover:bg-[#0C447C] transition-colors">
            {copied ? t('members.welcome.copied') : t('members.welcome.copy')}
          </button>
        </div>

        {/* Marche à suivre */}
        <ol className="list-decimal pl-5 space-y-2 text-[13px] text-slate-700 mb-5">
          <li>{t('members.welcome.step1')}</li>
          <li>{t('members.welcome.step2')}</li>
          <li>
            {t('members.welcome.step3')}
            <p className="mt-1.5 text-[12px] text-slate-600">🍎 {t('members.welcome.iphone')}</p>
            <p className="mt-1 text-[12px] text-slate-600">🤖 {t('members.welcome.android')}</p>
          </li>
        </ol>

        <button onClick={printSheet}
          className="w-full text-[13px] font-semibold py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors mb-6">
          🖨 {t('members.welcome.print')}
        </button>

        {/* Envoi par e-mail */}
        <div className="border-t border-slate-100 pt-5">
          <p className="text-[13px] font-bold text-slate-800 mb-1">{t('members.welcome.emailTitle')}</p>
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-[#185FA5] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pending.length === 0 ? (
            <p className="text-[12px] text-slate-500">{t('members.welcome.noPending')}</p>
          ) : (
            <>
              <p className="text-[12px] text-slate-500 mb-2">{t('members.welcome.emailHint')}</p>
              <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50 mb-3">
                {pending.map(p => (
                  <label key={p.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)}
                      className="w-4 h-4 accent-[#185FA5]" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] text-slate-800 truncate">{p.first_name} <strong>{p.surname}</strong></span>
                      <span className="block text-[11px] text-slate-400 truncate">{p.email}</span>
                    </span>
                  </label>
                ))}
              </div>
              <button onClick={sendEmails} disabled={sending || selected.size === 0}
                className="w-full bg-[#185FA5] text-white text-[13px] font-semibold py-2.5 rounded-xl hover:bg-[#0C447C] transition-colors disabled:opacity-40">
                {sending ? t('members.welcome.sending') : t('members.welcome.send', { count: selected.size })}
              </button>
            </>
          )}
          {result && (
            <p className={`text-[12px] mt-3 text-center font-semibold ${result.ok ? 'text-emerald-700' : 'text-red-600'}`}>
              {result.msg}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
