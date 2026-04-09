// Composant partagé pour toutes les pages auth
// À placer dans src/components/auth/AuthCard.tsx

import Link from 'next/link'

interface AuthCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/login" className="inline-flex items-baseline gap-0 select-none">
            <span className="text-[26px] font-medium text-[#185FA5] tracking-tight">Golf</span>
            <span className="text-[26px] font-medium text-[#97C459] tracking-tight">Go</span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-8">
          <div className="mb-6">
            <h1 className="text-[18px] font-medium text-gray-900">{title}</h1>
            {subtitle && (
              <p className="text-[13px] text-gray-400 mt-1">{subtitle}</p>
            )}
          </div>
          {children}
        </div>

        {/* Footer links */}
        {footer && (
          <div className="mt-4 text-center text-[13px] text-gray-400">
            {footer}
          </div>
        )}

      </div>
    </main>
  )
}

interface AuthInputProps {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  autoComplete?: string
  suffix?: React.ReactNode
}

export function AuthInput({
  label, type = 'text', value, onChange,
  placeholder, required, autoComplete, suffix,
}: AuthInputProps) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-gray-500 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] placeholder-gray-300 focus:outline-none focus:border-blue-300 pr-10"
        />
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {suffix}
          </div>
        )}
      </div>
    </div>
  )
}

export function AuthButton({
  loading, label, loadingLabel,
}: { loading: boolean; label: string; loadingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full bg-[#185FA5] text-white text-[13px] font-medium py-2.5 rounded-md hover:bg-[#0C447C] disabled:opacity-50 transition-colors"
    >
      {loading ? loadingLabel : label}
    </button>
  )
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
      {message}
    </div>
  )
}

export function AuthSuccess({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="text-[12px] text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
      {message}
    </div>
  )
}

export function EyeButton({
  show, onToggle,
}: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="text-gray-400 hover:text-gray-600 transition-colors"
    >
      {show ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.2"/>
          <circle cx="8" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M3 3l10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.2"/>
          <circle cx="8" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
        </svg>
      )}
    </button>
  )
}
