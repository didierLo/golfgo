import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!monitoring|api|_next/static|_next/image|favicon.ico).*)',
  ]
}