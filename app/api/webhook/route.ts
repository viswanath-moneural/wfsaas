import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { sendWhatsAppReply } from '@/lib/whatsapp'

let supabaseAdmin: SupabaseClient | null = null

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  return supabaseAdmin
}

// Session store
interface Session {
  step: string
  tenant_id?: string
  operator_id?: string
  operator_name?: string
  machines?: { id: string; machine_code: string; machine_name: string }[]
  products?: { id: string; product_code: string; product_name: string }[]
  selected_machine?: { id: string; machine_code: string; machine_name: string }
  selected_product?: { id: string; product_code: string; product_name: string }
  pack_quantity?: number
  packets_qty?: number
  entries?: { machine: string; product: string; cups: number; packets: number; boxes: number }[]
}

const sessions: Record<string, Session> = {}

const MAIN_MENU = `👋 *WhatsMFG*\n\nSelect an option:\n1️⃣  📦 Production Entry\n2️⃣  📄 Raw Material\n3️⃣  🔧 Downtime\n4️⃣  ❌ Quality Rejection\n\nReply with 1, 2, 3 or 4`

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = await req.json()
    const msg  = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
    if (!msg || msg.type !== 'text') return new Response('ok', { status: 200 })

    const phone = msg.from
    const text  = msg.text?.body?.trim() ?? ''
    const lower = text.toLowerCase()

    console.log(`📱 ${phone}: ${text}`)

    // Save message
    await supabaseAdmin.from('messages').insert({
      phone, content: text, parsed_type: 'UNKNOWN', tenant_id: null
    })

    // ── Greeting / reset ──────────────────────────────────────────────────
    const isGreeting = ['hi', 'hello', 'hey', 'menu', 'start', 'help', '0'].includes(lower)
    if (isGreeting || !sessions[phone]) {
      sessions[phone] = { step: 'main_menu' }
      await sendWhatsAppReply(phone, MAIN_MENU)
      return new Response('ok', { status: 200 })
    }

    const session = sessions[phone]

    // ── Main menu ─────────────────────────────────────────────────────────
    if (session.step === 'main_menu') {
      if (text === '1') {
        // Look up operator
        const { data: operator } = await supabaseAdmin
          .from('operators')
          .select('id, tenant_id, operator_name')
          .eq('phone', phone)
          .eq('status', 'Active')
          .single()

        if (!operator) {
          await sendWhatsAppReply(phone, `⚠️ Your number is not registered.\nContact your factory manager.`)
          return new Response('ok', { status: 200 })
        }

        // Fetch machines
        const { data: machines } = await supabaseAdmin
          .from('machines')
          .select('id, machine_code, machine_name')
          .eq('tenant_id', operator.tenant_id)
          .eq('status', 'Active')
          .order('machine_code')

        if (!machines?.length) {
          await sendWhatsAppReply(phone, `⚠️ No machines found. Contact manager.`)
          return new Response('ok', { status: 200 })
        }

        sessions[phone] = {
          step: 'select_machine',
          tenant_id: operator.tenant_id,
          operator_id: operator.id,
          operator_name: operator.operator_name,
          machines,
          entries: []
        }

        const list = machines.map((m, i) => `${i + 1}. ${m.machine_name} (${m.machine_code})`).join('\n')
        await sendWhatsAppReply(phone, `🏭 *Select Machine:*\n\n${list}\n\nReply with number`)

      } else if (text === '2' || text === '3' || text === '4') {
        await sendWhatsAppReply(phone, `🚧 Coming soon!\n\nSend *menu* to go back.`)
      } else {
        await sendWhatsAppReply(phone, `Please reply with 1, 2, 3 or 4\n\n${MAIN_MENU}`)
      }
      return new Response('ok', { status: 200 })
    }

    // ── Select machine ────────────────────────────────────────────────────
    if (session.step === 'select_machine') {
      const idx = parseInt(text) - 1
      const machines = session.machines ?? []

      if (isNaN(idx) || idx < 0 || idx >= machines.length) {
        const list = machines.map((m, i) => `${i + 1}. ${m.machine_name} (${m.machine_code})`).join('\n')
        await sendWhatsAppReply(phone, `❌ Invalid. Pick a number 1-${machines.length}\n\n${list}`)
        return new Response('ok', { status: 200 })
      }

      const selected_machine = machines[idx]

      // Fetch products
      const { data: products } = await supabaseAdmin
        .from('products')
        .select('id, product_code, product_name')
        .eq('tenant_id', session.tenant_id)
        .eq('is_active', true)
        .order('product_code')

      if (!products?.length) {
        await sendWhatsAppReply(phone, `⚠️ No products found. Contact manager.`)
        return new Response('ok', { status: 200 })
      }

      sessions[phone] = { ...session, step: 'select_product', selected_machine, products }

      const list = products.map((p, i) => `${i + 1}. ${p.product_name} (${p.product_code})`).join('\n')
      await sendWhatsAppReply(phone,
        `✅ Machine: *${selected_machine.machine_name}*\n\n📦 *Select Product:*\n\n${list}\n\nReply with number`
      )
      return new Response('ok', { status: 200 })
    }

    // ── Select product ────────────────────────────────────────────────────
    if (session.step === 'select_product') {
      const idx = parseInt(text) - 1
      const products = session.products ?? []

      if (isNaN(idx) || idx < 0 || idx >= products.length) {
        const list = products.map((p, i) => `${i + 1}. ${p.product_name} (${p.product_code})`).join('\n')
        await sendWhatsAppReply(phone, `❌ Invalid. Pick a number 1-${products.length}\n\n${list}`)
        return new Response('ok', { status: 200 })
      }

      const selected_product = products[idx]
      sessions[phone] = { ...session, step: 'enter_cups', selected_product }

      await sendWhatsAppReply(phone,
        `✅ Product: *${selected_product.product_name}*\n\n` +
        `☕ *Cups per packet?*\n\nEnter a number (max 100)`
      )
      return new Response('ok', { status: 200 })
    }

    // ── Enter cups ────────────────────────────────────────────────────────
    if (session.step === 'enter_cups') {
      const cups = parseInt(text)
      if (isNaN(cups) || cups < 1 || cups > 100) {
        await sendWhatsAppReply(phone, `❌ Invalid. Enter cups per packet (1-100)`)
        return new Response('ok', { status: 200 })
      }
      sessions[phone] = { ...session, step: 'enter_packets', pack_quantity: cups }
      await sendWhatsAppReply(phone, `✅ Cups: *${cups}*\n\n📦 *How many packets?*\n\nEnter number`)
      return new Response('ok', { status: 200 })
    }

    // ── Enter packets ─────────────────────────────────────────────────────
    if (session.step === 'enter_packets') {
      const packets = parseInt(text)
      if (isNaN(packets) || packets < 1) {
        await sendWhatsAppReply(phone, `❌ Invalid. Enter number of packets`)
        return new Response('ok', { status: 200 })
      }
      sessions[phone] = { ...session, step: 'enter_boxes', packets_qty: packets }
      await sendWhatsAppReply(phone, `✅ Packets: *${packets}*\n\n📦 *How many boxes?*\n\nEnter number`)
      return new Response('ok', { status: 200 })
    }

    // ── Enter boxes ───────────────────────────────────────────────────────
    if (session.step === 'enter_boxes') {
      const boxes = parseInt(text)
      if (isNaN(boxes) || boxes < 0) {
        await sendWhatsAppReply(phone, `❌ Invalid. Enter number of boxes`)
        return new Response('ok', { status: 200 })
      }

      const pack_quantity = session.pack_quantity ?? 0
      const packets_qty     = session.packets_qty ?? 0
      const total_cups      = pack_quantity * packets_qty

      // Save production run
      const { error } = await supabaseAdmin.from('production_runs').insert({
        tenant_id:   session.tenant_id,
        run_date:    new Date().toISOString().split('T')[0],
        product_id:  session.selected_product!.id,
        machine_id:  session.selected_machine!.id,
        operator_id: session.operator_id,
        shift:       'Day',
        pack_quantity,
        packets_qty,
        box_qty:     boxes,
      })

      if (error) {
        console.error('DB error:', error)
        await sendWhatsAppReply(phone, `❌ Error saving. Send *menu* to retry.`)
        return new Response('ok', { status: 200 })
      }

      // Add to entries log
      const entries = session.entries ?? []
      entries.push({
        machine:  session.selected_machine!.machine_code,
        product:  session.selected_product!.product_code,
        cups:     pack_quantity,
        packets:  packets_qty,
        boxes
      })

      sessions[phone] = { ...session, step: 'add_more', entries }

      await sendWhatsAppReply(phone,
        `✅ *Saved!*\n` +
        `🏭 ${session.selected_machine!.machine_name}\n` +
        `📦 ${session.selected_product!.product_name}\n` +
        `☕ ${pack_quantity} cups × ${packets_qty} pkts = ${total_cups} cups\n` +
        `📦 ${boxes} boxes\n\n` +
        `Add another product on same machine?\n` +
        `1. Yes — same machine\n` +
        `2. New machine\n` +
        `3. Done for now`
      )
      return new Response('ok', { status: 200 })
    }

    // ── Add more ──────────────────────────────────────────────────────────
    if (session.step === 'add_more') {
      if (text === '1') {
        // Same machine, new product
        const products = session.products ?? []
        const list = products.map((p, i) => `${i + 1}. ${p.product_name} (${p.product_code})`).join('\n')
        sessions[phone] = { ...session, step: 'select_product' }
        await sendWhatsAppReply(phone, `📦 *Select Product:*\n\n${list}\n\nReply with number`)

      } else if (text === '2') {
        // New machine
        const machines = session.machines ?? []
        const list = machines.map((m, i) => `${i + 1}. ${m.machine_name} (${m.machine_code})`).join('\n')
        sessions[phone] = { ...session, step: 'select_machine' }
        await sendWhatsAppReply(phone, `🏭 *Select Machine:*\n\n${list}\n\nReply with number`)

      } else if (text === '3') {
        // Done
        sessions[phone] = { step: 'main_menu' }
        await sendWhatsAppReply(phone,
          `👍 All entries saved!\n\nSend *menu* anytime to add more.`
        )
      } else {
        await sendWhatsAppReply(phone, `Reply 1 (same machine), 2 (new machine), or 3 (done)`)
      }
      return new Response('ok', { status: 200 })
    }

    // Fallback
    sessions[phone] = { step: 'main_menu' }
    await sendWhatsAppReply(phone, MAIN_MENU)
    return new Response('ok', { status: 200 })

  } catch (err) {
    console.error('💥 Error:', err)
    return new Response('ok', { status: 200 })
  }
}
