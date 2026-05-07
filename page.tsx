'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Stat {
  label: string
  value: string | number
  sub?: string
  color?: string
}

interface ProductionRow {
  id: string
  run_date: string
  shift: string
  packets_qty: number
  cups_per_packet: number
  machines: { machine_code: string } | null
  products: { product_code: string; product_name: string } | null
  operators: { operator_name: string } | null
}

interface RawMessage {
  id: string
  content: string
  parsed_type: string | null
  created_at: string
  phone: string
}

const TENANT_ID = '00000000-0000-0000-0000-000000000001'

export default function Dashboard() {
  const [runs, setRuns] = useState<ProductionRow[]>([])
  const [messages, setMessages] = useState<RawMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState('')

  useEffect(() => {
    setNow(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))
    fetchData()

    // Realtime subscription
    const channel = supabase
      .channel('production_runs_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'production_runs' }, () => fetchData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => fetchData())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchData() {
    const today = new Date().toISOString().split('T')[0]

    const [{ data: runsData }, { data: msgData }] = await Promise.all([
      supabase
        .from('production_runs')
        .select(`
          id, run_date, shift, packets_qty, cups_per_packet,
          machines(machine_code),
          products(product_code, product_name),
          operators(operator_name)
        `)
        .eq('tenant_id', TENANT_ID)
        .eq('run_date', today)
        .order('created_at', { ascending: false }),

      supabase
        .from('messages')
        .select('id, content, parsed_type, created_at, phone')
        .eq('tenant_id', TENANT_ID)
        .gte('created_at', `${today}T00:00:00`)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    setRuns((runsData as unknown as ProductionRow[]) ?? [])
    setMessages(msgData ?? [])
    setLoading(false)
  }

  const totalCups    = runs.reduce((s, r) => s + r.packets_qty * r.cups_per_packet, 0)
  const totalPackets = runs.reduce((s, r) => s + r.packets_qty, 0)
  const unknownCount = messages.filter(m => m.parsed_type === 'UNKNOWN').length

  const stats: Stat[] = [
    { label: 'TOTAL CUPS TODAY',    value: totalCups.toLocaleString(),    sub: 'across all machines',   color: '#00d4aa' },
    { label: 'TOTAL PACKETS',       value: totalPackets.toLocaleString(), sub: 'all shifts combined',   color: '#3b82f6' },
    { label: 'SHIFTS REPORTED',     value: runs.length,                   sub: 'machine-shift entries', color: '#a78bfa' },
    { label: 'UNREAD MESSAGES',     value: unknownCount,                  sub: 'need review',           color: unknownCount > 0 ? '#f59e0b' : '#00d4aa' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px', fontFamily: "'DM Mono', monospace" }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 3, marginBottom: 4 }}>WHATSMFG</div>
          <h1 style={{ margin: 0, fontSize: 22, color: 'var(--text)', fontWeight: 700 }}>MCM Paper Products</h1>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            {now} IST — Live Floor Data
          </div>
        </div>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: 11,
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          LIVE
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '20px 24px',
          }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 2, marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.color ?? 'var(--text)', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Production Runs */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 2, marginBottom: 16 }}>TODAY&apos;S PRODUCTION RUNS</div>
          {loading ? (
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading...</div>
          ) : runs.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>No production reported yet today.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ color: 'var(--muted)', textAlign: 'left' }}>
                  <th style={{ paddingBottom: 8, fontWeight: 500 }}>MACHINE</th>
                  <th style={{ paddingBottom: 8, fontWeight: 500 }}>PRODUCT</th>
                  <th style={{ paddingBottom: 8, fontWeight: 500 }}>SHIFT</th>
                  <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: 'right' }}>PKTS</th>
                  <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: 'right' }}>CUPS</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 0', color: 'var(--accent)' }}>{r.machines?.machine_code ?? '—'}</td>
                    <td style={{ padding: '8px 0' }}>{r.products?.product_code ?? '—'}</td>
                    <td style={{ padding: '8px 0', color: r.shift === 'Night' ? '#a78bfa' : '#f59e0b' }}>{r.shift}</td>
                    <td style={{ padding: '8px 0', textAlign: 'right' }}>{r.packets_qty}</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--accent2)' }}>{(r.packets_qty * r.cups_per_packet).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent Messages */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 2, marginBottom: 16 }}>RECENT MESSAGES</div>
          {messages.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>No messages today.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.slice(0, 10).map(m => (
                <div key={m.id} style={{
                  background: 'var(--surface2)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  borderLeft: `3px solid ${
                    m.parsed_type === 'PRODUCTION' ? 'var(--accent)' :
                    m.parsed_type === 'DOWNTIME'   ? 'var(--danger)' :
                    m.parsed_type === 'QUALITY'    ? 'var(--warn)' :
                    'var(--border)'
                  }`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>{m.phone}</span>
                    <span style={{
                      fontSize: 10,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: m.parsed_type === 'PRODUCTION' ? '#00d4aa22' : '#ffffff11',
                      color: m.parsed_type === 'PRODUCTION' ? 'var(--accent)' : 'var(--muted)',
                    }}>{m.parsed_type ?? 'UNKNOWN'}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text)' }}>{m.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
