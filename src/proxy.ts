import createMiddleware from 'next-intl/middleware'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const locales = ['en', 'fr', 'es', 'de', 'nl']

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale: 'en',
  localeDetection: true,
})

// Premier segment de route (juste après la locale) accessible sans être
// connecté. Tout ce qui n'est pas dans cette liste exige une session.
const PUBLIC_SEGMENTS = ['login', 'signup', 'forgot-password', 'reset-password', 'invite', 'legal']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Exclure sw.js et fichiers statiques
  if (pathname === '/sw.js' || pathname === '/offline.html') {
    return NextResponse.next()
  }

  const response = intlMiddleware(request)

  // Si next-intl redirige déjà (ex: pour ajouter le préfixe de locale
  // manquant), on laisse cette redirection se faire telle quelle — le
  // contrôle d'auth ci-dessous s'appliquera sur la requête suivante,
  // une fois l'URL correctement préfixée par la locale.
  if (response.headers.get('location')) {
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const segments = pathname.split('/').filter(Boolean)
  const locale = segments[0]
  const routeSegment = segments[1]

  const isProtected = Boolean(routeSegment) && !PUBLIC_SEGMENTS.includes(routeSegment)

  if (!user && isProtected) {
    const loginUrl = new URL(`/${locale}/login`, request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: ['/((?!api|monitoring|_next|_vercel|sw.js|.*\\..*).*)'],
}
