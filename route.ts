import { supabaseAdmin } from '@/lib/supabase'
import { classifyMessage, parseProductionMessage } from '@/lib/parser'
import { sendWhatsAppReply, buildConfirmationMessage } from '@/lib/whatsapp'

// ─── GET: Meta webhook verification ──────────────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('Webhook verified ✅')
    return new Response(challenge, { status: 200 })
  }

  return new Response('Forbidden', { status: 403 })
}

// ─── POST: Incoming WhatsApp messages ────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Extract message from Meta payload
    const entry   = body.entry?.[0]
    const change  = entry?.changes?.[0]
    const value   = change?.value
    const msg     = value?.messages?.[0]

    // Ignore status updates (delivered, read receipts)
    if (!msg || msg.type !== 'text') {
      return new Response('ok', { status: 200 })
    }

    const phone = msg.from                  // e.g. "917032828164"
    const text  = msg.text?.body ?? ''

    // ── 1. Resolve operator + tenant from phone ───────────────────────────
    const { data: operator } = await supabaseAdmin
      .from('operators')
      .select('id, tenant_id, operator_code, operator_name')
      .eq('phone', phone)
      .eq('status', 'Active')
      .single()

    const tenant_id = operator?.tenant_id ?? null

    // ── 2. Classify message ───────────────────────────────────────────────
    const parsed_type = classifyMessage(text)

    // ── 3. Log raw message ────────────────────────────────────────────────
    await supabaseAdmin.from('messages').insert({
      tenant_id,
      phone,
      content: text,
      parsed_type,
    })

    // ── 4. If unknown operator, ask them to register ──────────────────────
    if (!operator) {
      await sendWhatsAppReply(
        phone,
        `⚠️ Your number is not registered in WhatsMFG.\nContact your factory manager to get added.`
      )
      return new Response('ok', { status: 200 })
    }

    // ── 5. Process PRODUCTION messages ────────────────────────────────────
    if (parsed_type === 'PRODUCTION') {
      const parsed = parseProductionMessage(text)

      if (parsed.confidence === 'low') {
        await sendWhatsAppReply(
          phone,
          `⚠️ Could not read your message clearly.\n` +
          `Please send in format:\n` +
          `MCH-01 Day P001 50pkts 100cups`
        )
        return new Response('ok', { status: 200 })
      }

      // Look up machine and product IDs
      const [{ data: machine }, { data: product }] = await Promise.all([
        supabaseAdmin
          .from('machines')
          .select('id')
          .eq('tenant_id', tenant_id)
          .eq('machine_code', parsed.machine_code)
          .single(),
        supabaseAdmin
          .from('products')
          .select('id')
          .eq('tenant_id', tenant_id)
          .eq('product_code', parsed.product_code)
          .single(),
      ])

      if (!machine || !product) {
        await sendWhatsAppReply(
          phone,
          `❌ Machine "${parsed.machine_code}" or Product "${parsed.product_code}" not found.\nCheck codes and retry.`
        )
        return new Response('ok', { status: 200 })
      }

      const cups_per_packet = parsed.cups_per_packet ?? 100 // default fallback
      const packets_qty     = parsed.packets_qty ?? 0
      const total_cups      = cups_per_packet * packets_qty

      // Insert production run
      const { error } = await supabaseAdmin.from('production_runs').insert({
        tenant_id,
        run_date:        new Date().toISOString().split('T')[0],
        product_id:      product.id,
        machine_id:      machine.id,
        operator_id:     operator.id,
        shift:           parsed.shift ?? 'Day',
        cups_per_packet,
        packets_qty,
        box_qty:         0,
      })

      if (error) {
        // Likely duplicate (machine+date+shift unique constraint)
        if (error.code === '23505') {
          await sendWhatsAppReply(
            phone,
            `⚠️ A ${parsed.shift ?? 'Day'} shift entry for ${parsed.machine_code} today already exists.\nContact manager to correct it.`
          )
        } else {
          console.error('Insert error:', error)
          await sendWhatsAppReply(phone, `❌ Error saving. Please retry.`)
        }
        return new Response('ok', { status: 200 })
      }

      // Send confirmation
      await sendWhatsAppReply(
        phone,
        buildConfirmationMessage({
          operator_name: operator.operator_name,
          machine_code:  parsed.machine_code!,
          product_code:  parsed.product_code!,
          shift:         parsed.shift ?? 'Day',
          packets_qty,
          total_cups,
        })
      )
    }

    return new Response('ok', { status: 200 })

  } catch (err) {
    console.error('Webhook error:', err)
    return new Response('Internal error', { status: 500 })
  }
}
