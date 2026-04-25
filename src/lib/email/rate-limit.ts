/** Attend le délai nécessaire pour rester sous 5 emails/seconde (Resend free) */
export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * À appeler APRÈS chaque envoi dans une boucle.
 * 250ms = max 4/seconde → large marge sous la limite de 5/s
 */
export const EMAIL_SEND_DELAY_MS = 250