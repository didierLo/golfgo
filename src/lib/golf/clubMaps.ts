// Texte envoyé à Google Maps pour trouver le GOLF (et pas une rue du même nom : « Ravenstein » seul
// renvoie l'avenue de Ravenstein à Bruxelles). On ajoute le nom du parcours quand il existe
// (« The Royal Golf Club of Belgium — 18 » → « The Royal Golf Club of Belgium ») et le mot « golf ».
// Le pays n'est ajouté que s'il s'agit d'un vrai nom (pas d'un code comme « BE »).
export function clubMapsQuery(opts: { name?: string | null; courseName?: string | null; region?: string | null; country?: string | null }): string {
  const clean = (s?: string | null) => (s ?? '').split(/\s+[—–-]\s+/)[0].trim()
  const club   = clean(opts.name)
  const course = clean(opts.courseName)
  const parts: string[] = []
  if (course && course.toLowerCase() !== club.toLowerCase()) parts.push(course)
  if (club) parts.push(club)
  if (opts.region) parts.push(opts.region)
  if (opts.country && opts.country.length > 2) parts.push(opts.country)
  const text = parts.join(' ')
  return /golf/i.test(text) ? text : `${text} golf`.trim()
}
