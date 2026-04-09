'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Hole = {
  id?: string
  hole_number: number
  par: number
  stroke_index: number
}

export default function CourseEditor({ courseId }: { courseId: string }) {
  const supabase = createClient()

  const [holes, setHoles] = useState<Hole[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!courseId) return

    const load = async () => {
      setLoading(true)

      const { data, error } = await supabase
        .from('course_holes')
        .select('*')
        .eq('course_id', courseId)
        .order('hole_number')

      if (error) {
        console.error(error)
        setLoading(false)
        return
      }

      if (!data || data.length === 0) {
        const fallback = Array.from({ length: 18 }, (_, i) => ({
          hole_number: i + 1,
          par: 4,
          stroke_index: i + 1,
        }))
        setHoles(fallback)
      } else {
        setHoles(data)
      }

      setLoading(false)
    }

    load()
  }, [courseId])

  const updateHole = (index: number, field: keyof Hole, value: number) => {
    const updated = [...holes]
    updated[index] = { ...updated[index], [field]: value }
    setHoles(updated)
  }

  if (!courseId) return null

  if (loading) {
    return <div>Loading holes...</div>
  }

  // 👉 SPLIT 1–9 / 10–18
  const front9 = holes.slice(0, 9)
  const back9 = holes.slice(9, 18)

  const sumPar = (arr: Hole[]) =>
    arr.reduce((acc, h) => acc + (h.par || 0), 0)

  return (
    <div className="space-y-6">

      {/* FRONT 9 */}
      <div>
        <h3 className="font-semibold mb-2">Front 9</h3>

        <table className="border border-black border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2">Hole</th>
              <th className="border px-2">Par</th>
              <th className="border px-2">SI</th>
            </tr>
          </thead>

          <tbody>
            {front9.map((h, i) => (
              <tr key={h.id || h.hole_number}>
                <td className="border text-center">{h.hole_number}</td>

                <td className="border text-center">
                  <input
                    type="number"
                    value={h.par}
                    onChange={(e) =>
                      updateHole(i, 'par', Number(e.target.value))
                    }
                    className="w-16 text-center"
                  />
                </td>

                <td className="border text-center">
                  <input
                    type="number"
                    value={h.stroke_index}
                    onChange={(e) =>
                      updateHole(i, 'stroke_index', Number(e.target.value))
                    }
                    className="w-16 text-center"
                  />
                </td>
              </tr>
            ))}

            <tr className="font-semibold">
              <td className="border text-center">OUT</td>
              <td className="border text-center">{sumPar(front9)}</td>
              <td className="border"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* BACK 9 */}
      <div>
        <h3 className="font-semibold mb-2">Back 9</h3>

        <table className="border border-black border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2">Hole</th>
              <th className="border px-2">Par</th>
              <th className="border px-2">SI</th>
            </tr>
          </thead>

          <tbody>
            {back9.map((h, i) => (
              <tr key={h.id || h.hole_number}>
                <td className="border text-center">{h.hole_number}</td>

                <td className="border text-center">
                  <input
                    type="number"
                    value={h.par}
                    onChange={(e) =>
                      updateHole(i + 9, 'par', Number(e.target.value))
                    }
                    className="w-16 text-center"
                  />
                </td>

                <td className="border text-center">
                  <input
                    type="number"
                    value={h.stroke_index}
                    onChange={(e) =>
                      updateHole(i + 9, 'stroke_index', Number(e.target.value))
                    }
                    className="w-16 text-center"
                  />
                </td>
              </tr>
            ))}

            <tr className="font-semibold">
              <td className="border text-center">IN</td>
              <td className="border text-center">{sumPar(back9)}</td>
              <td className="border"></td>
            </tr>

            <tr className="font-bold">
              <td className="border text-center">TOT</td>
              <td className="border text-center">
                {sumPar(front9) + sumPar(back9)}
              </td>
              <td className="border"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}