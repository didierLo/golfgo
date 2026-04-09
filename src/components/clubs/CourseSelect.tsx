'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Course = {
  id: string
  course_name: string
}

type Props = {
  clubId: string | null
  value: string | null
  onChange: (courseId: string | null) => void
}

export default function CourseSelect({ clubId, value, onChange }: Props) {
  const supabase = createClient()

  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)

  // 🔁 fetch courses quand club change
  useEffect(() => {
    async function fetchCourses() {
      if (!clubId) {
        setCourses([])
        return
      }

      setLoading(true)

      const { data, error } = await supabase
        .from('courses')
        .select('id, course_name, club_id')
        .eq('club_id', clubId)
        .order('course_name')

      if (error) {
        console.error('Error loading courses:', error)
        setCourses([])
      } else {
        setCourses(data || [])
      }

      setLoading(false)
    }

    fetchCourses()
  }, [clubId])

  // 🔁 reset course quand club change
  useEffect(() => {
    onChange(null)
  }, [clubId])

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">Course</label>

      <select
        className="border p-2 w-full"
        value={value ?? ''}
        onChange={(e) =>
          onChange(e.target.value === '' ? null : e.target.value)
        }
        disabled={!clubId || loading}
      >
        <option value="">
          {!clubId
            ? 'Select a club first'
            : loading
            ? 'Loading courses...'
            : 'Select a course'}
        </option>

        {courses.map((course) => (
          <option key={course.id} value={course.id}>
            {course.course_name}
          </option>
        ))}
      </select>

      {/* debug utile */}
      {clubId && !loading && courses.length === 0 && (
        <p className="text-xs text-gray-500">
          ⚠️ No courses found for this club
        </p>
      )}
    </div>
  )
}