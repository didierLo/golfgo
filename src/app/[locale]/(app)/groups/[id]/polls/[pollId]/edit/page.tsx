'use client'

import { useParams } from 'next/navigation'
import PollForm from '@/components/polls/PollForm'

export default function EditPollPage() {
  const params = useParams()
  return <PollForm groupId={params.id as string} pollId={params.pollId as string} />
}
