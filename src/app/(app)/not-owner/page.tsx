export default function NotOwnerPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-[#E6F1FB] flex items-center justify-center mb-5">
        {/* icône groupes */}
      </div>
      <h2 className="text-[18px] font-medium text-gray-900 mb-2">
        Fonctionnalité réservée aux organisateurs
      </h2>
      <p className="text-[14px] text-gray-400 max-w-xs mb-6">
        Crée un groupe pour organiser tes événements et inviter des joueurs.
      </p>
      <a href="/groups/add"
        className="bg-[#185FA5] text-white text-[13px] font-medium px-5 py-2.5 rounded-md hover:bg-[#0C447C] transition-colors">
        + Créer un groupe →
      </a>
    </div>
  )
}