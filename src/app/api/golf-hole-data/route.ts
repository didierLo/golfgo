import { createServerClient } from '@/lib/supabase/server'
import { buildHoles, type OsmElement } from '@/lib/golf/holeGeo'

// Données de parcours (trous + greens) autour d'une position, depuis OpenStreetMap (Overpass).
// Données © contributeurs OpenStreetMap, licence ODbL — la mention figure sur l'écran de distance.
//
// Le proxy de l'appli (proxy.ts) ne protège pas /api : la vérification de connexion se fait donc ici.

export const dynamic = 'force-dynamic'

const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]
const SEARCH_RADIUS_M = 3000
const CACHE_SECONDS = 60 * 60 * 24 * 7 // un parcours ne change pas d'une semaine à l'autre
const USER_AGENT = 'GolfGo/1.0 (https://golfgo.be; info@golfgo.be)'

async function fetchOverpass(lat: number, lon: number): Promise<OsmElement[]> {
  const query =
    `[out:json][timeout:25];(` +
    `way["golf"="hole"](around:${SEARCH_RADIUS_M},${lat},${lon});` +
    `way["golf"="green"](around:${SEARCH_RADIUS_M},${lat},${lon});` +
    `);out geom;`

  let lastError = 'Overpass indisponible'
  for (const server of OVERPASS_SERVERS) {
    try {
      // GET (et non POST) : Next peut alors mettre la réponse en cache, ce qui épargne les serveurs d'OpenStreetMap.
      const res = await fetch(`${server}?data=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
        next: { revalidate: CACHE_SECONDS },
      })
      if (!res.ok) {
        lastError = `${server} a répondu ${res.status}`
        continue
      }
      const data = await res.json()
      return (data.elements ?? []) as OsmElement[]
    } catch (e: any) {
      lastError = e?.message ?? 'Erreur réseau'
    }
  }
  throw new Error(lastError)
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

  // Position arrondie (~1 km) pour la requête : deux joueurs sur le même parcours partagent la même entrée de cache.
  const roundedLat = Math.round(lat * 100) / 100
  const roundedLon = Math.round(lon * 100) / 100

  try {
    const elements = await fetchOverpass(roundedLat, roundedLon)
    const holes = buildHoles(elements, [lat, lon])
    return Response.json({ holes }, { headers: { 'Cache-Control': 'private, max-age=3600' } })
  } catch (e: any) {
    return Response.json({ error: e?.message ?? 'Erreur' }, { status: 502 })
  }
}
