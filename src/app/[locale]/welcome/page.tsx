'use client'

import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

export default function WelcomePage() {
  const router = useRouter()
  const locale = useLocale()

  function go(destination: string) {
    localStorage.setItem('golfgo_welcome_seen', 'true')
    router.push(`/${locale}/${destination}`)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'transparent, rgba(42,82,152,0.72) 0%, rgba(15,110,86,0.65) 100%)',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(14px)',
        borderRadius: '16px',
        padding: '32px 28px',
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: '#EEF4FF', color: '#2a5298',
          fontSize: '12px', fontWeight: 500,
          padding: '4px 12px', borderRadius: '20px', marginBottom: '16px',
        }}>
          Bienvenue sur GolfGo
        </div>

        <h1 style={{ fontSize: '20px', fontWeight: 500, color: '#1a1a1a', marginBottom: '8px' }}>
          Comment souhaitez-vous utiliser GolfGo ?
        </h1>
        <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.6, marginBottom: '24px' }}>
          GolfGo organise vos sorties golf entre amis — invitations, flights équilibrés,
          cartes de score et leaderboard, tout au même endroit.
        </p>

        <div style={{ height: '0.5px', background: 'rgba(0,0,0,0.1)', marginBottom: '24px' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button onClick={() => go('my-events')} style={{
            border: 'none', cursor: 'pointer', borderRadius: '12px',
            padding: '22px 16px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: '12px', background: '#2a5298',
          }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '13px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '28px', background: 'rgba(255,255,255,0.2)', color: '#fff',
            }}>
              <i className="ti ti-user" aria-hidden="true" />
            </div>
            <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>Je suis joueur</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', lineHeight: 1.45 }}>
              Je rejoins les événements organisés par mon groupe et je suis mes scores.
            </div>
          </button>

          <button onClick={() => go('groups/add')} style={{
            border: 'none', cursor: 'pointer', borderRadius: '12px',
            padding: '22px 16px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: '12px', background: '#1D9E75',
          }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '13px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '28px', background: 'rgba(255,255,255,0.2)', color: '#fff',
            }}>
              <i className="ti ti-users-group" aria-hidden="true" />
            </div>
            <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>Je gère un groupe</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', lineHeight: 1.45 }}>
              J'organise les événements, j'invite les membres et je gère les flights.
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}