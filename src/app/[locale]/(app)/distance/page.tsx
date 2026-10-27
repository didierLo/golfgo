'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  distancesToGreen,
  lineLength,
  nearestHole,
  distanceMeters,
  type HoleGeo,
  type LatLon,
} from '@/lib/golf/holeGeo'

type Position = { lat: number; lon: number; accuracy: number }
type GeoError = 'denied' | 'unavailable' | null
type LoadState = 'idle' | 'loading' | 'ready' | 'error'

// En dessous de cette distance à la ligne du trou le plus proche, on considère que le joueur est sur le parcours.
const ON_COURSE_M = 800
// Au-delà de cette distance du point où les données ont été chargées, on les recharge.
const RELOAD_M = 2000

export default function DistancePage() {
  const t = useTranslations('distance')

  const [pos, setPos] = useState<Position | null>(null)
  const [geoError, setGeoError] = useState<GeoError>(null)
  const [holes, setHoles] = useState<HoleGeo[]>([])
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [fetchedAt, setFetchedAt] = useState<LatLon | null>(null)
  // null = trou choisi automatiquement ; sinon, trou choisi à la main (par sa référence).
  const [manualRef, setManualRef] = useState<number | null>(null)
  const fetching = useRef(false)

  // ── Position GPS en continu ──
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('unavailable')
      return
    }
    const id = navigator.geolocation.watchPosition(
      p => {
        setGeoError(null)
        setPos({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy })
      },
      err => setGeoError(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  // ── Écran qui reste allumé pendant l'utilisation (si le téléphone le permet) ──
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    let cancelled = false
    const request = async () => {
      try {
        const wl = (navigator as any).wakeLock
        if (!wl || document.visibilityState !== 'visible') return
        const l = await wl.request('screen')
        if (cancelled) await l.release()
        else lock = l
      } catch {
        // Non pris en charge ou refusé : sans importance.
      }
    }
    request()
    document.addEventListener('visibilitychange', request)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', request)
      lock?.release().catch(() => {})
    }
  }, [])

  // ── Chargement des données du parcours ──
  const load = useCallback(async (lat: number, lon: number) => {
    if (fetching.current) return
    fetching.current = true
    setLoadState('loading')
    try {
      const res = await fetch(`/api/golf-hole-data?lat=${lat}&lon=${lon}`)
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      setHoles((data.holes ?? []) as HoleGeo[])
      setFetchedAt([lat, lon])
      setManualRef(null)
      setLoadState('ready')
    } catch {
      setLoadState('error')
    } finally {
      fetching.current = false
    }
  }, [])

  useEffect(() => {
    if (!pos) return
    if (loadState === 'idle') {
      load(pos.lat, pos.lon)
    } else if (loadState === 'ready' && fetchedAt && distanceMeters(fetchedAt, [pos.lat, pos.lon]) > RELOAD_M) {
      load(pos.lat, pos.lon)
    }
  }, [pos, loadState, fetchedAt, load])

  // ── Trou affiché et distances ──
  const player: LatLon | null = pos ? [pos.lat, pos.lon] : null
  const nearest = useMemo(() => (player && holes.length > 0 ? nearestHole(player, holes) : null), [pos, holes]) // eslint-disable-line react-hooks/exhaustive-deps
  const onCourse = nearest !== null && nearest.distance <= ON_COURSE_M

  const currentIndex = useMemo(() => {
    if (holes.length === 0) return -1
    if (manualRef !== null) {
      const i = holes.findIndex(h => h.ref === manualRef)
      if (i >= 0) return i
    }
    return nearest ? nearest.index : -1
  }, [holes, manualRef, nearest])

  const hole = currentIndex >= 0 ? holes[currentIndex] : null
  const distances = player && hole ? distancesToGreen(player, hole.green) : null

  const step = (delta: number) => {
    if (holes.length === 0 || currentIndex < 0) return
    const next = (currentIndex + delta + holes.length) % holes.length
    setManualRef(holes[next].ref)
  }

  const m = (v: number | undefined) => (v === undefined ? '—' : String(Math.round(v)))

  // ── Rendu ──
  let status: string | null = null
  if (geoError === 'denied') status = t('gpsDenied')
  else if (geoError === 'unavailable' && !pos) status = t('gpsUnavailable')
  else if (!pos) status = t('locating')
  else if (loadState === 'idle' || loadState === 'loading') status = t('searching')
  else if (loadState === 'error') status = t('loadError')
  else if (holes.length === 0 || (!onCourse && manualRef === null)) status = t('noCourse')

  return (
    <div className="max-w-md mx-auto px-4 pt-14 sm:pt-6 pb-28 sm:pb-8">
      <h1 className="text-[20px] font-extrabold text-slate-800 on-bg mb-4">{t('title')}</h1>

      {status && (
        <div className="on-bg-card text-center">
          <p className="text-[15px] font-semibold text-slate-700">{status}</p>
          {(loadState === 'error' || geoError) && (
            <button
              onClick={() => {
                setGeoError(null)
                if (pos) load(pos.lat, pos.lon)
                else window.location.reload()
              }}
              className="mt-4 px-5 py-3 rounded-xl bg-[#185FA5] text-white text-[15px] font-bold"
            >
              {t('retry')}
            </button>
          )}
        </div>
      )}

      {!status && hole && (
        <div className="on-bg-card">
          <div className="flex items-baseline justify-between mb-1">
            <p className="text-[22px] font-extrabold text-slate-800">
              {t('hole')} {hole.ref}
            </p>
            <p className="text-[14px] font-semibold text-slate-600">
              {hole.par !== null ? `${t('par')} ${hole.par} · ` : ''}
              {Math.round(lineLength(hole.line))} {t('unit')}
            </p>
          </div>

          {distances ? (
            <>
              <div className="text-center my-5">
                <p className="text-[12px] font-bold uppercase tracking-widest text-slate-500">{t('center')}</p>
                <p className="text-[84px] leading-none font-black text-[#185FA5] tabular-nums">{m(distances.center)}</p>
                <p className="text-[16px] font-semibold text-slate-500 mt-1">{t('unit')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/70 py-3 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{t('front')}</p>
                  <p className="text-[34px] leading-tight font-extrabold text-slate-800 tabular-nums">{m(distances.front)}</p>
                </div>
                <div className="rounded-xl bg-white/70 py-3 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{t('back')}</p>
                  <p className="text-[34px] leading-tight font-extrabold text-slate-800 tabular-nums">{m(distances.back)}</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-center text-[15px] font-semibold text-slate-600 py-10">{t('noGreen')}</p>
          )}

          <div className="grid grid-cols-2 gap-3 mt-5">
            <button
              onClick={() => step(-1)}
              className="h-14 rounded-xl bg-white/80 border border-slate-200 text-[16px] font-bold text-slate-800 active:bg-slate-100"
            >
              ◀ {t('prev')}
            </button>
            <button
              onClick={() => step(1)}
              className="h-14 rounded-xl bg-white/80 border border-slate-200 text-[16px] font-bold text-slate-800 active:bg-slate-100"
            >
              {t('next')} ▶
            </button>
          </div>

          <button
            onClick={() => setManualRef(null)}
            disabled={manualRef === null}
            className={`w-full mt-3 h-11 rounded-xl text-[14px] font-bold ${
              manualRef === null ? 'bg-[#185FA5]/10 text-[#185FA5]' : 'bg-[#185FA5] text-white'
            }`}
          >
            {manualRef === null ? t('autoOn') : t('autoOff')}
          </button>
        </div>
      )}

      <div className="mt-4 space-y-1 text-center">
        {pos && <p className="text-[12px] text-slate-600 on-bg">{t('accuracy', { m: Math.round(pos.accuracy) })}</p>}
        <p className="text-[11px] text-slate-500 on-bg">{t('disclaimer')}</p>
        <p className="text-[11px] text-slate-500 on-bg">{t('attribution')}</p>
      </div>
    </div>
  )
}
