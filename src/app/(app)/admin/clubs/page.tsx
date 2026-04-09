import ClubCourseManager from '@/components/clubs/ClubCourseManager'
import ImportClubs from '@/components/clubs/ImportClubs'

export default function ClubsPage() {
  return (
    <div className="p-6 max-w-4xl">

      <div className="mb-6">
        <h1 className="text-[18px] font-medium text-gray-900">Clubs & Parcours</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">Gérer les clubs et parcours disponibles</p>
      </div>

      {/* Import XLS */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Import depuis fichier fédération (XLS)
        </p>
        <ImportClubs />
      </div>

      {/* Gestion manuelle */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Gestion manuelle
        </p>
        <ClubCourseManager />
      </div>

    </div>
  )
}
