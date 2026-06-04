import createMiddleware from 'next-intl/middleware'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const intlMiddleware = createMiddleware({
  locales: ['en', 'fr', 'es', 'de', 'nl'],
  defaultLocale: 'en',
  localeDetection: true,
})

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Exclure sw.js et fichiers statiques
  if (pathname === '/sw.js' || pathname === '/offline.html') {
    return NextResponse.next()
  }

  let response = intlMiddleware(request)

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

  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: ['/((?!api|monitoring|_next|_vercel|sw.js|.*\\..*).*)'],
}