import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ id: string; eventId: string }>
}

export default async function ViewPage({ params }: Props) {
  const { id, eventId } = await params
  redirect(`/groups/${id}/events/${eventId}`)
}
