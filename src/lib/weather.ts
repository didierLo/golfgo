// Utilitaires météo partagés (serveur ET client) — Open-Meteo, gratuit, sans clé API.

export const WEATHER_CODES: Record<number, { emoji: string; label: string }> = {
  0:  { emoji: '☀️', label: 'Ciel dégagé' },
  1:  { emoji: '🌤️', label: 'Peu nuageux' },
  2:  { emoji: '⛅', label: 'Partiellement nuageux' },
  3:  { emoji: '☁️', label: 'Couvert' },
  45: { emoji: '🌫️', label: 'Brouillard' },
  48: { emoji: '🌫️', label: 'Brouillard givrant' },
  51: { emoji: '🌦️', label: 'Bruine légère' },
  53: { emoji: '🌦️', label: 'Bruine' },
  55: { emoji: '🌦️', label: 'Bruine forte' },
  61: { emoji: '🌧️', label: 'Pluie légère' },
  63: { emoji: '🌧️', label: 'Pluie' },
  65: { emoji: '🌧️', label: 'Pluie forte' },
  71: { emoji: '🌨️', label: 'Neige légère' },
  73: { emoji: '🌨️', label: 'Neige' },
  75: { emoji: '🌨️', label: 'Neige forte' },
  80: { emoji: '🌧️', label: 'Averses' },
  81: { emoji: '🌧️', label: 'Averses' },
  82: { emoji: '🌧️', label: 'Averses fortes' },
  95: { emoji: '⛈️', label: 'Orage' },
  96: { emoji: '⛈️', label: 'Orage avec grêle' },
  99: { emoji: '⛈️', label: 'Orage violent' },
}

export function weatherCodeInfo(code: number) {
  return WEATHER_CODES[code] ?? { emoji: '🌡️', label: 'Prévision indisponible' }
}

export const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  BE: 'Belgique', FR: 'France', NL: 'Pays-Bas', LU: 'Luxembourg', DE: 'Allemagne',
  GB: 'Royaume-Uni', ES: 'Espagne', PT: 'Portugal', IT: 'Italie', CH: 'Suisse',
  US: 'États-Unis', ID: 'Indonésie',
}

// Retire les préfixes golfiques courants pour améliorer les chances de géocodage
// (ex. "Golf de Louvain-La-Neuve" → "Louvain-La-Neuve")
export function simplifyLocationQuery(raw: string): string {
  return raw
    .replace(/^(royal\s+)?golf(\s*(club|course))?\s+(de|du|des|d')\s+/i, '')
    .replace(/^golfclub\s+/i, '')
    .trim()
}

export type GeoResult = { lat: number; lon: number }

export async function geocodeLocation(query: string, countryCode?: string): Promise<GeoResult | null> {
  try {
    const params = new URLSearchParams({ name: query, count: '1', language: 'fr', format: 'json' })
    if (countryCode && countryCode !== 'OTHER') params.set('countryCode', countryCode)
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`)
    if (!res.ok) return null
    const json = await res.json()
    const first = json?.results?.[0]
    return first ? { lat: first.latitude, lon: first.longitude } : null
  } catch {
    return null
  }
}

export type EventForGeocode = {
  location: string | null
  courses?: { course_name?: string | null; clubs?: { name?: string | null; region?: string | null; country?: string | null } | null } | null
}

// Essaie plusieurs sources dans l'ordre, du plus précis (texte libre de l'organisateur)
// au plus fiable (région/pays du club lié à l'événement), jusqu'à ce qu'une réussisse.
export async function geocodeEventLocation(event: EventForGeocode): Promise<{ coords: GeoResult; label: string } | null> {
  const club = event.courses?.clubs
  const attempts: { query: string; countryCode?: string; label: string }[] = []

  if (event.location) {
    attempts.push({ query: event.location, label: event.location })
    const simplified = simplifyLocationQuery(event.location)
    if (simplified !== event.location) attempts.push({ query: simplified, label: event.location })
  }
  if (event.courses?.course_name) {
    attempts.push({ query: event.courses.course_name, countryCode: club?.country ?? undefined, label: event.courses.course_name })
  }
  if (club?.name) {
    attempts.push({ query: club.name, countryCode: club.country ?? undefined, label: club.name })
  }
  if (club?.region) {
    const countryName = club.country ? COUNTRY_CODE_TO_NAME[club.country] : undefined
    const query = countryName ? `${club.region}, ${countryName}` : club.region
    attempts.push({ query, countryCode: club.country ?? undefined, label: club.name ?? club.region })
  }

  for (const attempt of attempts) {
    const coords = await geocodeLocation(attempt.query, attempt.countryCode)
    if (coords) return { coords, label: attempt.label }
  }
  return null
}

export type HourlyPoint = { hour: number; label: string; temp: number; precipProb: number; code: number; isDay: boolean }

// Prévisions heure par heure autour d'un moment donné (ex. l'heure de départ),
// par défaut de 1h avant à 6h après. Peut chevaucher deux dates calendaires.
export async function fetchHourlyWindow(
  lat: number, lon: number, aroundISO: string, hoursBefore = 1, hoursAfter = 6
): Promise<HourlyPoint[] | null> {
  const start = new Date(aroundISO)
  const wanted: { dateISO: string; hour: number }[] = []
  for (let offset = -hoursBefore; offset <= hoursAfter; offset++) {
    const d = new Date(start.getTime() + offset * 3600 * 1000)
    wanted.push({ dateISO: d.toISOString().slice(0, 10), hour: d.getUTCHours() })
  }
  const dates = Array.from(new Set(wanted.map(w => w.dateISO))).sort()
  const startDate = dates[0]
  const endDate   = dates[dates.length - 1]

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&hourly=temperature_2m,precipitation_probability,weathercode,is_day` +
      `&timezone=Europe%2FBrussels&start_date=${startDate}&end_date=${endDate}`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    const times: string[] = json?.hourly?.time ?? []
    if (!times.length) return null

    const points: HourlyPoint[] = []
    for (const w of wanted) {
      const key = `${w.dateISO}T${String(w.hour).padStart(2, '0')}:00`
      const idx = times.indexOf(key)
      if (idx === -1) continue
      points.push({
        hour:       w.hour,
        label:      `${String(w.hour).padStart(2, '0')}h`,
        temp:       Math.round(json.hourly.temperature_2m[idx]),
        precipProb: json.hourly.precipitation_probability[idx],
        code:       json.hourly.weathercode[idx],
        isDay:      json.hourly.is_day[idx] === 1,
      })
    }
    return points.length ? points : null
  } catch {
    return null
  }
}