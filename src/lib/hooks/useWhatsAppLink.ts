import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

/**
 * Résout le lien WhatsApp à utiliser :
 * 1. whatsapp_link de l'event (si défini)
 * 2. whatsapp_link du groupe (si défini)
 * 3. null → fallback sur wa.me/?text=...
 */
export function useWhatsAppLink(eventId: string | null, groupId: string | null) {
  const [whatsappLink, setWhatsappLink] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!eventId && !groupId) { setLoading(false); return }
    resolve()
  }, [eventId, groupId])

  async function resolve() {
    setLoading(true)

    // 1. Chercher le lien de l'event
    if (eventId) {
      const { data: event } = await supabase
        .from('events')
        .select('whatsapp_link, group_id')
        .eq('id', eventId)
        .single()

      if (event?.whatsapp_link) {
        setWhatsappLink(event.whatsapp_link)
        setLoading(false)
        return
      }

      // 2. Fallback sur le groupe de l'event
      const gId = event?.group_id ?? groupId
      if (gId) {
        const { data: group } = await supabase
          .from('groups')
          .select('whatsapp_link')
          .eq('id', gId)
          .single()

        setWhatsappLink(group?.whatsapp_link ?? null)
        setLoading(false)
        return
      }
    }

    // 3. Chercher directement sur le groupe
    if (groupId) {
      const { data: group } = await supabase
        .from('groups')
        .select('whatsapp_link')
        .eq('id', groupId)
        .single()

      setWhatsappLink(group?.whatsapp_link ?? null)
    }

    setLoading(false)
  }

  return { whatsappLink, loading }
}
