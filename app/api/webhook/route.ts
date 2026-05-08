import { createClient } from '@supabase/supabase-js'
import { classifyMessage } from '@/lib/parser'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log('📨 RAW BODY:', JSON.stringify(body))

    const msg = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
    console.log('📩 MSG:', JSON.stringify(msg))

    if (!msg || msg.type !== 'text') {
      console.log('⏭ Skipping — no text message')
      return new Response('ok', { status: 200 })
    }

    const phone = msg.from
    const text  = msg.text?.body ?? ''
    console.log(`📱 From: ${phone} | Text: ${text}`)

    const parsed_type = classifyMessage(text)
    console.log('🏷 Type:', parsed_type)

    const { data, error } = await supabaseAdmin
      .from('messages')
      .insert({ phone, content: text, parsed_type, tenant_id: null })
      .select()

    console.log('💾 Insert result:', JSON.stringify({ data, error }))

    if (error) {
      console.error('❌ DB Error:', JSON.stringify(error))
    } else {
      console.log('✅ Saved to DB!')
    }

    return new Response('ok', { status: 200 })

  } catch (err) {
    console.error('💥 Error:', String(err))
    return new Response('ok', { status: 200 })
  }
}