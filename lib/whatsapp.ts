/**
 * Send a WhatsApp text message back to an operator via Meta Cloud API.
 */
export async function sendWhatsAppReply(to: string, message: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_API_TOKEN

  if (!phoneNumberId || !token) {
    console.error('WhatsApp env vars not set')
    return
  }

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    console.error('WhatsApp send failed:', err)
  }
}

/**
 * Build a confirmation reply message for a production entry.
 */
export function buildConfirmationMessage(params: {
  operator_name: string
  machine_code: string
  product_code: string
  shift: string
  packets_qty: number
  total_cups: number
}): string {
  return (
    `✅ Recorded!\n` +
    `👷 ${params.operator_name}\n` +
    `🏭 ${params.machine_code} | ${params.shift} Shift\n` +
    `📦 ${params.product_code} — ${params.packets_qty} packets (${params.total_cups} cups)\n` +
    `Reply with corrections if needed.`
  )
}




