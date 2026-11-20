// Corrige le lien « Itinéraire » de la page d'un événement (groupe → événement) : il envoyait à Google Maps
// « lieu + parcours + club » sans le mot « golf », ce qui pouvait mener à une rue du même nom (ex. Ravenstein).
// Modifie le fichier en place, uniquement si le texte attendu y est ; sans effet s'il est déjà corrigé.
//   node scripts/apply-maps-fix.cjs

const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '..', 'src', 'app', '[locale]', '(app)', 'groups', '[id]', 'events', '[eventId]', 'page.tsx')
let s = fs.readFileSync(file, 'utf8')

if (s.includes('clubMapsQuery')) { console.log('page.tsx de l\'événement : déjà corrigé'); process.exit(0) }

const importAnchor = "import { useGroupRole } from '@/lib/hooks/useGroupRole'"
const oldRe = /const mapsQuery = \[event\.location, event\.courses\?\.course_name, \(event\.courses\?\.clubs as any\)\?\.name\]\s*\.filter\(Boolean\)\.join\(' '\)/

if (!s.includes(importAnchor) || !oldRe.test(s)) {
  console.error('Texte attendu introuvable : le fichier a changé, rien n\'a été modifié. Dis-le moi et je te donne la modification exacte.')
  process.exit(1)
}

s = s.replace(importAnchor, importAnchor + "\nimport { clubMapsQuery } from '@/lib/golf/clubMaps'")
s = s.replace(oldRe, `const clubName = (event.courses?.clubs as any)?.name
              const mapsQuery = clubName
                ? clubMapsQuery({ name: clubName, courseName: event.courses?.course_name })
                : [event.location, event.courses?.course_name].filter(Boolean).join(' ')`)
fs.writeFileSync(file, s)
console.log('page.tsx de l\'événement : lien Itinéraire corrigé')
