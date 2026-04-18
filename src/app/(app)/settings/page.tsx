export default function SettingsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-white/40 flex items-center justify-center mb-4">
        <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="2.5" stroke="#94A3B8" strokeWidth="1.4"/>
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"
            stroke="#94A3B8" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </div>
      <p className="text-[15px] font-bold text-slate-700 mb-1">Settings</p>
      <p className="text-[13px] text-slate-500">Bientôt disponible</p>
    </div>
  )
}
