'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import PageHeader from '@/components/layout/PageHeader'
import Badge from '@/components/ui/Badge'
import { useAuth } from '@/lib/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'

interface ProductionRow {
  id: string
  run_date: string
  shift: string | null
  pack_quantity: number | null
  packets_qty: number | null
  box_qty: number | null
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

export default function DashboardPage() {
  const { org, tenant, permissions, isLoading: authLoading } = useAuth()
  const [runs, setRuns] = useState<ProductionRow[]>([])
  const [messages, setMessages] = useState<RawMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenant?.id) {
      setLoading(false)
      return
    }

    const supabase = getSupabaseClient()
    fetchData(tenant.id)

    const channel = supabase
      .channel(`dashboard_${tenant.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'production_runs', filter: `tenant_id=eq.${tenant.id}` },
        () => fetchData(tenant.id)
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `tenant_id=eq.${tenant.id}` },
        () => fetchData(tenant.id)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenant?.id])

  async function fetchData(tenantId: string) {
    const supabase = getSupabaseClient()
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    const [{ data: runsData }, { data: msgData }] = await Promise.all([
      supabase
        .from('production_runs')
        .select(`
          id, run_date, shift, pack_quantity, packets_qty, box_qty,
          machines(machine_code),
          products(product_code, product_name),
          operators(operator_name)
        `)
        .eq('tenant_id', tenantId)
        .eq('run_date', today)
        .order('created_at', { ascending: false }),
      supabase
        .from('messages')
        .select('id, content, parsed_type, created_at, phone')
        .eq('tenant_id', tenantId)
        .gte('created_at', `${today}T00:00:00`)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    setRuns((runsData as unknown as ProductionRow[]) ?? [])
    setMessages(msgData ?? [])
    setLoading(false)
  }

  const stats = useMemo(() => {
    const totalPackets = runs.reduce((sum, run) => sum + Number(run.packets_qty ?? 0), 0)
    const totalUnits = runs.reduce(
      (sum, run) => sum + Number(run.packets_qty ?? 0) * Number(run.pack_quantity ?? 0),
      0
    )
    const unknownMessages = messages.filter((message) => message.parsed_type === 'UNKNOWN').length

    return [
      { label: 'Units Today', value: totalUnits.toLocaleString(), hint: 'pack quantity x packets' },
      { label: 'Packets Today', value: totalPackets.toLocaleString(), hint: 'all reported runs' },
      { label: 'Runs Today', value: runs.length.toLocaleString(), hint: 'machine-shift entries' },
      { label: 'Messages To Review', value: unknownMessages.toLocaleString(), hint: 'unknown parser output' },
    ]
  }, [messages, runs])

  if (authLoading || loading) {
    return <PageHeader title="Dashboard" description="Loading your workspace..." />
  }

  if (!tenant) {
    return (
      <PageHeader
        title="Dashboard"
        description="No active factory is assigned to your user yet. Configure a tenant before entering transactions."
      />
    )
  }

  return (
    <>
      <PageHeader title="Dashboard" description={`${org?.name ?? 'Organisation'} / ${tenant.name}`} />

      <section className="stats-grid">
        {stats.map((stat) => (
          <Card key={stat.label} padding="md">
            <p className="stat-label">{stat.label}</p>
            <strong className="stat-value">{stat.value}</strong>
            <span className="stat-hint">{stat.hint}</span>
          </Card>
        ))}
      </section>

      <section className="dashboard-grid">
        <Card>
          <div className="panel-heading">
            <h2>Today&apos;s Production Runs</h2>
            <Badge variant="primary">{runs.length} rows</Badge>
          </div>
          {runs.length === 0 ? (
            <p className="empty">No production runs reported today.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Machine</th>
                    <th>Product</th>
                    <th>Shift</th>
                    <th>Packets</th>
                    <th>Units</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id}>
                      <td>{run.machines?.machine_code ?? '-'}</td>
                      <td>{run.products?.product_code ?? run.products?.product_name ?? '-'}</td>
                      <td>{run.shift ?? '-'}</td>
                      <td>{run.packets_qty ?? 0}</td>
                      <td>{Number(run.packets_qty ?? 0) * Number(run.pack_quantity ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <div className="panel-heading">
            <h2>Recent Messages</h2>
            <Badge variant="slate">{messages.length} today</Badge>
          </div>
          {messages.length === 0 ? (
            <p className="empty">No messages received today.</p>
          ) : (
            <div className="message-list">
              {messages.map((message) => (
                <article key={message.id} className="message-item">
                  <div>
                    <strong>{message.phone}</strong>
                    <Badge variant={message.parsed_type === 'UNKNOWN' ? 'warning' : 'success'} size="sm">
                      {message.parsed_type ?? 'UNKNOWN'}
                    </Badge>
                  </div>
                  <p>{message.content}</p>
                </article>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="module-strip" aria-label="Enabled modules">
        {(permissions?.enabled_modules ?? []).map((moduleKey) => (
          <Badge key={moduleKey} variant="info">
            {moduleKey}
          </Badge>
        ))}
      </section>

      <style jsx>{`
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: var(--space-4);
          margin-bottom: var(--space-6);
        }

        .stat-label,
        .stat-hint,
        .empty,
        .message-item p {
          margin: 0;
        }

        .stat-label {
          color: var(--text-secondary);
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          text-transform: uppercase;
          letter-spacing: var(--tracking-wider);
        }

        .stat-value {
          display: block;
          margin-top: var(--space-2);
          color: var(--text-primary);
          font-size: var(--text-4xl);
          line-height: var(--leading-tight);
        }

        .stat-hint {
          display: block;
          margin-top: var(--space-1);
          color: var(--text-secondary);
          font-size: var(--text-xs);
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
          gap: var(--space-6);
        }

        .panel-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-3);
          margin-bottom: var(--space-4);
        }

        h2 {
          margin: 0;
          font-size: var(--text-lg);
        }

        .empty {
          color: var(--text-secondary);
          font-size: var(--text-sm);
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--text-sm);
        }

        th,
        td {
          padding: var(--space-2) 0;
          border-bottom: 1px solid var(--border-default);
          text-align: left;
        }

        th {
          color: var(--text-secondary);
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          text-transform: uppercase;
        }

        .message-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .message-item {
          padding: var(--space-3);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          background: var(--surface-table-row-alt);
        }

        .message-item div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-2);
          margin-bottom: var(--space-2);
          font-size: var(--text-xs);
        }

        .message-item p {
          color: var(--text-primary);
          font-size: var(--text-sm);
          line-height: var(--leading-normal);
        }

        .module-strip {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
          margin-top: var(--space-6);
        }

        @media (max-width: 1100px) {
          .stats-grid,
          .dashboard-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .stats-grid,
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  )
}
