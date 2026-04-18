export default function NotOwnerPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-white/50 flex items-center justify-center mb-5">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <circle cx="10" cy="9" r="4" stroke="#185FA5" strokeWidth="1.5"/>
          <path d="M2 23c0-4.42 3.58-8 8-8a8 8 0 018 8" stroke="#185FA5" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="20" cy="9" r="3" stroke="#185FA5" strokeWidth="1.5"/>
          <path d="M20 16c1.5.5 3 1.5 4 3" stroke="#185FA5" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <h2 className="text-[18px] font-black text-slate-900 mb-2">
        Fonctionnalité réservée aux organisateurs
      </h2>
      <p className="text-[14px] text-slate-600 max-w-xs mb-6">
        Crée un groupe pour organiser tes événements et inviter des joueurs.
      </p>
      <a href="/groups/add"
        className="bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] transition-colors">
        + Créer un groupe →
      </a>
    </div>
  )
}
