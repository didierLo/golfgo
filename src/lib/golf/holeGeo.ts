// Distances au green à partir des données OpenStreetMap (golf=hole / golf=green).
//
// Fonctions pures (aucun accès réseau, aucune dépendance) : utilisées côté serveur
// (src/app/api/golf-hole-data/route.ts) pour relier chaque trou à son green, et côté
// navigateur (src/app/[locale]/(app)/distance/page.tsx) pour calculer les distances en direct.
//
// Données © contributeurs OpenStreetMap, licence ODbL.

export type LatLon = [number, number] // [latitude, longitude]

// Forme des éléments renvoyés par Overpass avec « out geom ».
export type OsmElement = {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  geometry?: { lat: number; lon: number }[]
  tags?: Record<string, string>
}

// Un trou prêt à l'emploi : sa ligne de jeu (départ → green) et le contour de son green.
export type HoleGeo = {
  ref: number
  par: number | null
  line: LatLon[]
  green: LatLon[] | null
}

export type GreenDistances = { front: number; center: number; back: number }

// ── Géométrie de base (projection locale en mètres, suffisante à l'échelle d'un parcours) ──

const M_PER_DEG_LAT = 111_132
const mPerDegLon = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180)

type XY = [number, number]

function project(p: LatLon, origin: LatLon): XY {
  return [(p[1] - origin[1]) * mPerDegLon(origin[0]), (p[0] - origin[0]) * M_PER_DEG_LAT]
}

export function distanceMeters(a: LatLon, b: LatLon): number {
  const [x, y] = project(b, a)
  return Math.hypot(x, y)
}

function centroid(points: LatLon[]): LatLon {
  // Un contour fermé répète son premier point à la fin : on l'ignore pour ne pas le compter deux fois.
  const pts =
    points.length > 1 &&
    points[0][0] === points[points.length - 1][0] &&
    points[0][1] === points[points.length - 1][1]
      ? points.slice(0, -1)
      : points
  let la = 0
  let lo = 0
  for (const p of pts) {
    la += p[0]
    lo += p[1]
  }
  return [la / pts.length, lo / pts.length]
}

// Distance minimale entre un point et une ligne brisée.
export function distanceToLine(p: LatLon, line: LatLon[]): number {
  if (line.length === 0) return Infinity
  if (line.length === 1) return distanceMeters(p, line[0])
  let best = Infinity
  for (let i = 0; i < line.length - 1; i++) {
    const a = project(line[i], p)
    const b = project(line[i + 1], p)
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len2 = dx * dx + dy * dy
    // Le point est à l'origine (0,0) de la projection.
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / len2))
    best = Math.min(best, Math.hypot(a[0] + t * dx, a[1] + t * dy))
  }
  return best
}

// ── Lecture des éléments OpenStreetMap ──

function pointsOf(el: OsmElement): LatLon[] {
  if (el.geometry && el.geometry.length > 0) return el.geometry.map(g => [g.lat, g.lon] as LatLon)
  if (typeof el.lat === 'number' && typeof el.lon === 'number') return [[el.lat, el.lon]]
  return []
}

const MAX_GREEN_GAP_M = 60 // un green plus loin que ça de la fin de la ligne n'est pas celui du trou
const CLUSTER_LINK_M = 1500 // deux trous plus proches que ça appartiennent au même parcours

// Relie chaque trou numéroté à son green, puis garde uniquement le parcours le plus proche du joueur
// (plusieurs parcours peuvent se trouver dans le rayon de recherche).
export function buildHoles(elements: OsmElement[], player: LatLon): HoleGeo[] {
  const greens = elements
    .filter(e => e.tags?.golf === 'green')
    .map(e => pointsOf(e))
    .filter(pts => pts.length >= 3)
    .map(pts => ({ pts, c: centroid(pts) }))

  const nearestGreen = (p: LatLon) => {
    let best: { pts: LatLon[]; c: LatLon } | null = null
    let bestD = Infinity
    for (const g of greens) {
      const d = distanceMeters(p, g.c)
      if (d < bestD) {
        bestD = d
        best = g
      }
    }
    return { green: best, dist: bestD }
  }

  const holes: HoleGeo[] = []
  for (const e of elements) {
    if (e.tags?.golf !== 'hole') continue
    const ref = parseInt(e.tags?.ref ?? '', 10)
    if (!Number.isFinite(ref)) continue
    let line = pointsOf(e)
    if (line.length < 2) continue

    // Par convention la ligne va du départ au green ; si un contributeur l'a dessinée à l'envers,
    // on la retourne d'après le bout le plus proche d'un green.
    const atEnd = nearestGreen(line[line.length - 1])
    const atStart = nearestGreen(line[0])
    let match = atEnd
    if (atStart.dist < atEnd.dist) {
      line = [...line].reverse()
      match = atStart
    }

    const parNum = parseInt(e.tags?.par ?? '', 10)
    holes.push({
      ref,
      par: Number.isFinite(parNum) ? parNum : null,
      line,
      green: match.green && match.dist <= MAX_GREEN_GAP_M ? match.green.pts : null,
    })
  }
  if (holes.length === 0) return []

  // Regroupement en parcours : composantes connexes des trous proches les uns des autres.
  const centers = holes.map(h => centroid(h.line))
  const parent = holes.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (let i = 0; i < holes.length; i++) {
    for (let j = i + 1; j < holes.length; j++) {
      if (distanceMeters(centers[i], centers[j]) <= CLUSTER_LINK_M) parent[find(i)] = find(j)
    }
  }

  let nearest = 0
  let nearestD = Infinity
  holes.forEach((h, i) => {
    const d = distanceToLine(player, h.line)
    if (d < nearestD) {
      nearestD = d
      nearest = i
    }
  })
  const root = find(nearest)
  return holes.filter((_, i) => find(i) === root).sort((a, b) => a.ref - b.ref)
}

// ── Côté navigateur : distances en direct ──

// Devant / centre / derrière du green, mesurés dans l'axe joueur → centre du green.
export function distancesToGreen(player: LatLon, green: LatLon[] | null): GreenDistances | null {
  if (!green || green.length < 3) return null
  const c = centroid(green)
  const [cx, cy] = project(c, player)
  const dCenter = Math.hypot(cx, cy)
  if (dCenter < 0.5) return { front: 0, center: 0, back: 0 }
  const ux = cx / dCenter
  const uy = cy / dCenter
  let minS = Infinity
  let maxS = -Infinity
  for (const v of green) {
    const [vx, vy] = project(v, player)
    const s = (vx - cx) * ux + (vy - cy) * uy
    if (s < minS) minS = s
    if (s > maxS) maxS = s
  }
  return {
    front: Math.max(0, dCenter + minS),
    center: dCenter,
    back: Math.max(0, dCenter + maxS),
  }
}

// Indice du trou dont la ligne de jeu est la plus proche du joueur, et cette distance.
export function nearestHole(player: LatLon, holes: HoleGeo[]): { index: number; distance: number } {
  let index = 0
  let distance = Infinity
  holes.forEach((h, i) => {
    const d = distanceToLine(player, h.line)
    if (d < distance) {
      distance = d
      index = i
    }
  })
  return { index, distance }
}

// Longueur de la ligne de jeu, en mètres (indicative : ce n'est pas la distance officielle de la carte).
export function lineLength(line: LatLon[]): number {
  let total = 0
  for (let i = 0; i < line.length - 1; i++) total += distanceMeters(line[i], line[i + 1])
  return total
}
