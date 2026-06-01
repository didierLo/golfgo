'use client'

import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

export default function WelcomePage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('welcome')

  function go(destination: string) {
    router.push(`/${locale}/${destination}`)
  }

  return (
    <div className="flex items-center justify-center min-h-full p-6">
      <div style={{
        background: 'rgba(255,255,255,0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.6)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        borderRadius: '20px',
        padding: '40px 32px',
        maxWidth: '520px',
        width: '100%',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: '#185FA5', color: '#fff',
          fontSize: '15px', fontWeight: 700,
          padding: '8px 20px', borderRadius: '30px', marginBottom: '24px',
        }}>
          {t('badge')}
        </div>

        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#1a1a1a', marginBottom: '10px' }}>
          {t('title')}
        </h1>
        <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.6, marginBottom: '32px' }}>
          {t('subtitle')}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <button onClick={() => go('my-events')} style={{
            border: 'none', cursor: 'pointer', borderRadius: '14px',
            padding: '24px 16px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: '12px', background: '#185FA5',
          }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '13px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: '28px',
            }}>
              <i className="ti ti-user" />
            </div>
            <div style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{t('playerTitle')}</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', lineHeight: 1.5 }}>
              {t('playerDesc')}
            </div>
          </button>

          <button onClick={() => go('groups/add')} style={{
            border: 'none', cursor: 'pointer', borderRadius: '14px',
            padding: '24px 16px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: '12px', background: '#1D9E75',
          }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '13px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: '28px',
            }}>
              <i className="ti ti-users-group" />
            </div>
            <div style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{t('ownerTitle')}</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', lineHeight: 1.5 }}>
              {t('ownerDesc')}
            </div>
          </button>
        </div>

        <button
          onClick={() => go('my-events')}
          style={{
            marginTop: '20px',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '13px', color: '#888',
            textDecoration: 'underline', textUnderlineOffset: '3px',
          }}
        >
          {t('skip')}
        </button>
      </div>
    </div>
  )
}