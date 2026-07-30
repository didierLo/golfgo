export const DEFAULT_LOGO_URL = 'https://www.golfgo.be/apple-touch-icon.png'
export const DEFAULT_SCORECARD_LOGO_URL = 'https://golfgo.be/logo/GG_Logo_avec_nom_bandeau.jpeg'

/**
 * Génère le HTML du header logo pour les emails (table-based, compatible clients mail).
 * Si logoUrl est fourni (upload custom du groupe), affiche l'image seule.
 * Sinon, affiche l'icône + texte "GolfGo" par défaut.
 */
export function buildEmailLogoHeader(logoUrl: string | null | undefined): string {
  if (logoUrl) {
    return `<img src="${logoUrl}" alt="GolfGo" style="max-height:36px;max-width:220px;object-fit:contain;vertical-align:middle;" />`
  }
  return `<img src="${DEFAULT_LOGO_URL}" width="32" height="32" alt="GolfGo" style="vertical-align:middle;border-radius:6px;margin-right:8px;" />
       <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;vertical-align:middle;">Golf</span>
       <span style="font-size:20px;font-weight:700;color:#97C459;letter-spacing:-0.5px;vertical-align:middle;">Go</span>`
}

/** Résout le logo pour l'impression (scorecards), avec fallback sur le défaut GolfGo. */
export function resolveScorecardLogoUrl(logoUrl: string | null | undefined): string {
  return logoUrl || DEFAULT_SCORECARD_LOGO_URL
}