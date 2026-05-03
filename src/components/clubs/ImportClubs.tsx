'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

// ─── Types ────────────────────────────────────────────────────────────────────

type RawRow = {
  club: string
  course: string
  tee: string
  par: number
  length_m: number | null
  cr: number | null
  slope: number
}

type ImportResult = {
  clubs: number
  courses: number
  tees: number
  skipped: number
  errors: string[]
}
// ─── Template download ─────────────────────────────────────────────────────────

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['CLUB', 'COURSE', 'TEE', 'PAR', 'LENGTH', 'CR', 'SLOPE'],
    ['Royal Golf Club', 'Parcours Principal', 'Jaune', 72, 5800, 71.2, 128],
    ['Royal Golf Club', 'Parcours Principal', 'Rouge', 72, 5200, 69.4, 122],
  ])
  ws['!cols'] = [
    { wch: 30 }, { wch: 25 }, { wch: 15 },
    { wch: 8  }, { wch: 10 }, { wch: 8  }, { wch: 8 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Clubs')
  XLSX.writeFile(wb, 'template_clubs_golfgo.xlsx')
}
// ─── Parser XLS ───────────────────────────────────────────────────────────────

function parseXLS(file: File): Promise<RawRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result
        const workbook = XLSX.read(buffer, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

        // Trouver la ligne header
        let headerRow = -1
        for (let i = 0; i < Math.min(raw.length, 10); i++) {
          const row = raw[i].map((c: any) => String(c).trim().toUpperCase())
          if (row.some(c => c === 'CLUB') && row.some(c => c.includes('SLOPE'))) {
            headerRow = i
            break
          }
        }
        if (headerRow === -1) {
          reject(new Error('Format non reconnu — colonnes CLUB et SLOPE introuvables'))
          return
        }

        const headers = raw[headerRow].map((c: any) => String(c).trim().toUpperCase())
        const idx = {
          club:   headers.findIndex(h => h === 'CLUB'),
          course: headers.findIndex(h => h === 'COURSE'),
          tee:    headers.findIndex(h => h === 'TEE'),
          par:    headers.findIndex(h => h === 'PAR'),
          length: headers.findIndex(h => h.includes('LENGTH') || h === 'M'),
          cr:     headers.findIndex(h => h === 'CR'),
          slope:  headers.findIndex(h => h === 'SLOPE'),
        }

        const rows: RawRow[] = []
        let lastClub = ''
        let lastCourse = ''

        for (let i = headerRow + 1; i < raw.length; i++) {
          const row = raw[i]
          if (!row || row.every((c: any) => !c)) continue

          const club   = String(row[idx.club]   ?? '').trim() || lastClub
          const course = String(row[idx.course] ?? '').trim() || lastCourse
          const tee    = String(row[idx.tee]    ?? '').trim()
          const par    = Number(row[idx.par])
          const slope  = Number(row[idx.slope])

          if (club)   lastClub = club
          if (course) lastCourse = course

          if (!tee || !slope || isNaN(slope)) continue

          // 18 trous uniquement (par > 30)
          if (par && par <= 30) continue

          rows.push({
            club:     lastClub,
            course:   lastCourse,
            tee,
            par:      isNaN(par) ? 72 : par,
            length_m: idx.length >= 0 ? Number(row[idx.length]) || null : null,
            cr:       idx.cr >= 0 ? Number(row[idx.cr]) || null : null,
            slope,
          })
        }

        resolve(rows)
      } catch (err: any) {
        reject(new Error(err.message ?? 'Erreur de lecture du fichier'))
      }
    }
    reader.onerror = () => reject(new Error('Impossible de lire le fichier'))
    reader.readAsArrayBuffer(file)
  })
}

// ─── Import Supabase ──────────────────────────────────────────────────────────

async function importToSupabase(rows: RawRow[]): Promise<ImportResult> {
  const result: ImportResult = { clubs: 0, courses: 0, tees: 0, skipped: 0, errors: [] }

  const clubMap = new Map<string, Map<string, RawRow[]>>()
  for (const row of rows) {
    if (!clubMap.has(row.club)) clubMap.set(row.club, new Map())
    const courseMap = clubMap.get(row.club)!
    if (!courseMap.has(row.course)) courseMap.set(row.course, [])
    courseMap.get(row.course)!.push(row)
  }

  for (const [clubName, courseMap] of clubMap) {
    let clubId: string
    const { data: existingClub } = await supabase
      .from('clubs').select('id').ilike('name', clubName).maybeSingle()

    if (existingClub) {
      clubId = existingClub.id
      result.skipped++
    } else {
      const { data: newClub, error } = await supabase
        .from('clubs').insert({ name: clubName }).select('id').single()
      if (error || !newClub) { result.errors.push(`Club "${clubName}": ${error?.message}`); continue }
      clubId = newClub.id
      result.clubs++
    }

    for (const [courseName, teeRows] of courseMap) {
      let courseId: string
      const { data: existingCourse } = await supabase
        .from('courses').select('id').eq('club_id', clubId).ilike('course_name', courseName).maybeSingle()

      if (existingCourse) {
        courseId = existingCourse.id
      } else {
        const { data: newCourse, error } = await supabase
          .from('courses').insert({ club_id: clubId, course_name: courseName }).select('id').single()
        if (error || !newCourse) { result.errors.push(`Parcours "${courseName}": ${error?.message}`); continue }
        courseId = newCourse.id
        result.courses++
      }

      for (const row of teeRows) {
        const { data: existingTee } = await supabase
          .from('course_tees').select('id').eq('course_id', courseId).ilike('tee_name', row.tee).maybeSingle()

        if (existingTee) { result.skipped++; continue }

        const { error } = await supabase.from('course_tees').insert({
          course_id:     courseId,
          tee_name:      row.tee,
          par_total:     row.par,
          course_rating: row.cr,
          slope:         row.slope,
          distance_total: row.length_m,
        })
        if (error) { result.errors.push(`Tee "${row.tee}" (${courseName}): ${error.message}`); continue }
        result.tees++
      }
    }
  }

  return result
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function ImportClubs() {
  const [preview, setPreview] = useState<RawRow[]>([])
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [parseError, setParseError] = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setPreview([])
    setResult(null)
    setParseError('')
    setParsing(true)
    try {
      const rows = await parseXLS(f)
      setPreview(rows)
    } catch (err: any) {
      setParseError(err.message)
    } finally {
      setParsing(false)
    }
  }

  async function handleImport() {
    if (!preview.length) return
    setImporting(true)
    try {
      const res = await importToSupabase(preview)
      setResult(res)
    } finally {
      setImporting(false)
    }
  }

  const clubCount  = new Set(preview.map(r => r.club)).size
  const courseCount = new Set(preview.map(r => `${r.club}__${r.course}`)).size

  return (
    <div className="flex flex-col gap-4">
        {/* Template download */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[12px] text-gray-500">
            Utilise le format fédération belge, ou télécharge le template GolfGo.
          </p>
          <button
            type="button"
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 text-[12px] font-medium text-[#185FA5] hover:text-[#0C447C] border border-[#185FA5]/30 hover:border-[#185FA5] px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v8M5 7l3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Template Excel
          </button>
        </div>
        
      {/* Upload */}
      <div>
        <label className="block text-[12px] font-medium text-gray-500 mb-1.5">
          Fichier XLS / XLSX (format fédération belge)
        </label>
        <input
          type="file"
          accept=".xls,.xlsx"
          onChange={handleFile}
          className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] text-gray-600 file:mr-3 file:border-0 file:bg-blue-50 file:text-blue-700 file:text-[12px] file:font-medium file:px-3 file:py-1 file:rounded-md cursor-pointer"
        />
      </div>

      {/* Parsing */}
      {parsing && (
        <div className="flex items-center gap-2 text-[13px] text-gray-400">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          Lecture du fichier…
        </div>
      )}

      {/* Erreur */}
      {parseError && (
        <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {parseError}
        </div>
      )}

      {/* Aperçu */}
      {preview.length > 0 && !result && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-medium text-gray-500">
              {clubCount} clubs · {courseCount} parcours · {preview.length} tees détectés
            </p>
            <button onClick={() => setPreview([])} className="text-[11px] text-gray-400 hover:text-gray-600">
              Effacer
            </button>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
            <table className="w-full text-[11px]" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-gray-400 font-medium w-[25%]">Club</th>
                  <th className="px-3 py-2 text-left text-gray-400 font-medium w-[20%]">Parcours</th>
                  <th className="px-3 py-2 text-left text-gray-400 font-medium w-[25%]">Tee</th>
                  <th className="px-3 py-2 text-center text-gray-400 font-medium w-[10%]">Par</th>
                  <th className="px-3 py-2 text-center text-gray-400 font-medium w-[10%]">CR</th>
                  <th className="px-3 py-2 text-center text-gray-400 font-medium w-[10%]">Slope</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className={`border-b border-gray-100 ${i % 2 ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-3 py-1.5 text-gray-700 truncate">{row.club}</td>
                    <td className="px-3 py-1.5 text-gray-600 truncate">{row.course}</td>
                    <td className="px-3 py-1.5 text-gray-600 truncate">{row.tee}</td>
                    <td className="px-3 py-1.5 text-center text-gray-500">{row.par}</td>
                    <td className="px-3 py-1.5 text-center text-gray-500">{row.cr ?? '—'}</td>
                    <td className="px-3 py-1.5 text-center text-gray-500">{row.slope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleImport}
            disabled={importing}
            className="mt-3 flex items-center gap-2 bg-[#185FA5] text-white text-[13px] font-medium px-5 py-2 rounded-md hover:bg-[#0C447C] disabled:opacity-50 transition-colors"
          >
            {importing && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {importing ? 'Import en cours…' : `Importer ${preview.length} tees`}
          </button>
        </div>
      )}

      {/* Résultat */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex flex-col gap-3">
          <p className="text-[13px] font-medium text-green-800">Import terminé</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { n: result.clubs,   label: 'clubs créés' },
              { n: result.courses, label: 'parcours créés' },
              { n: result.tees,    label: 'tees créés' },
            ].map(({ n, label }) => (
              <div key={label} className="bg-white border border-green-100 rounded-md p-2 text-center">
                <div className="text-[20px] font-medium text-green-700">{n}</div>
                <div className="text-[11px] text-gray-400">{label}</div>
              </div>
            ))}
          </div>
          {result.skipped > 0 && (
            <p className="text-[12px] text-gray-400">{result.skipped} entrées déjà existantes ignorées</p>
          )}
          {result.errors.length > 0 && (
            <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
              {result.errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
          <button
            onClick={() => { setResult(null); setPreview([]) }}
            className="text-[12px] text-blue-600 hover:underline self-start"
          >
            Importer un autre fichier
          </button>
        </div>
      )}
    </div>
  )
}
