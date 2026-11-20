'use client'

import { useParams } from 'next/navigation'
import PollForm from '@/components/polls/PollForm'

export default function NewPollPage() {
  const params = useParams()
  return <PollForm groupId={params.id as string} />
}
