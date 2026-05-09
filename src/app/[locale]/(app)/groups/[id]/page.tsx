'use client'

import { useParams } from 'next/navigation'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Cette page est rarement visitée directement — on redirige vers events
export default function GroupPage() {
  const params  = useParams()
  const groupId = params.id as string
  const router  = useRouter()

  useEffect(() => {
    router.replace(`/groups/${groupId}/events`)
  }, [groupId])

  return (
    <div className="p-6 flex items-center justify-center min-h-[200px]">
      <div className="w-8 h-8 border-2 border-[#185FA5] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
