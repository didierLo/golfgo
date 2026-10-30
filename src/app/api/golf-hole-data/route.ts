import { createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { buildHoles, distanceToLine, type HoleGeo, type OsmElement } from '@/lib/golf/holeGeo'

// Données de parcours (trous + greens) autour d'une position.
// 1) D'abord notre propre base (table golf_geo_cache) : réponse instantanée, sans service externe.
// 2) Sinon OpenStreetMap (Overpass), puis le résultat est mémorisé dans la base pour les fois suivantes.
// Données © contributeurs OpenStreetMap, licence ODbL — la mention figure sur l'écran de distance.
//
// Le proxy de l'appli (proxy.ts) ne protège pas /api : la vérification de connexion se fait donc ici.

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]
const SEARCH_RADIUS_M = 3000
const USER_AGENT = 'GolfGo/1.0 (https://golfgo.be; info@golfgo.be)'
// Marge autour du parcours enregistré dans laquelle on considère que le joueur est « sur place » (~700 m).
const MARGIN_LAT = 0.0065
const MARGIN_LON = 0.01

async function fetchOverpass(lat: number, lon: number): Promise<OsmElement[]> {
  const query =
    `[out:json][timeout:20];(` +
    `way["golf"="hole"](around:${SEARCH_RADIUS_M},${lat},${lon});` +
    `way["golf"="green"](around:${SEARCH_RADIUS_M},${lat},${lon});` +
    `);out geom;`

  // Les trois serveurs sont interrogés en même temps : le premier qui répond gagne.
  const one = async (server: string): Promise<OsmElement[]> => {
    const res = await fetch(`${server}?data=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) throw new Error(`${server} a répondu ${res.status}`)
    const data = await res.json()
    return (data.elements ?? []) as OsmElement[]
  }
  return Promise.any(OVERPASS_SERVERS.map(one))
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const lat = Number(searchParams.get('lat'))
  const lon = Number(searchParams.get('lon'))
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return Response.json({ error: 'Position invalide' }, { status: 400 })
  }

  // ── 1. Base GolfGo ──
  try {
    const { data: rows } = await supabase
      .from('golf_geo_cache')
      .select('holes, min_lat, max_lat, min_lon, max_lon')
      .lte('min_lat', lat + MARGIN_LAT)
      .gte('max_lat', lat - MARGIN_LAT)
      .lte('min_lon', lon + MARGIN_LON)
      .gte('max_lon', lon - MARGIN_LON)
    let best: HoleGeo[] | null = null
    let bestDist = Infinity
    for (const r of rows ?? []) {
      const holes = (r.holes ?? []) as HoleGeo[]
      for (const h of holes) {
        const d = distanceToLine([lat, lon], h.line)
        if (d < bestDist) { bestDist = d; best = holes }
      }
    }
    if (best && bestDist <= 1200) {
      return Response.json({ holes: best, source: 'cache' }, { headers: { 'Cache-Control': 'private, max-age=3600' } })
    }
  } catch {
    // La base ne répond pas : on tente OpenStreetMap.
  }

  // ── 2. OpenStreetMap, puis mémorisation ──
  try {
    const elements = await fetchOverpass(Math.round(lat * 100) / 100, Math.round(lon * 100) / 100)
    const holes = buildHoles(elements, [lat, lon])

    if (holes.length >= 9) {
      try {
        const admin = adminClient()
        if (admin) {
          const pts = holes.flatMap(h => [...h.line, ...(h.green ?? [])])
          const lats = pts.map(p => p[0]), lons = pts.map(p => p[1])
          await admin.from('golf_geo_cache').insert({
            min_lat: Math.min(...lats), max_lat: Math.max(...lats),
            min_lon: Math.min(...lons), max_lon: Math.max(...lons),
            hole_count: holes.length, holes, source: 'osm',
          })
        }
      } catch {
        // Mémorisation facultative.
      }
    }
    return Response.json({ holes, source: 'osm' }, { headers: { 'Cache-Control': 'private, max-age=3600' } })
  } catch (e: any) {
    return Response.json({ error: e?.message ?? 'Erreur' }, { status: 502 })
  }
}
