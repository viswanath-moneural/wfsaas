'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import Card from '@/components/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useToast } from '@/lib/hooks/useToast'
import type { ModuleManagerData } from '@/lib/moduleManager'
import { useModuleStore } from '@/lib/stores/useModuleStore'

type ViewMode = 'landing' | 'clouds' | 'apps'

export default function ModuleManagerClient({
  initialData,
  mode,
  selectedCloudKey,
  selectedAppKey,
}: {
  initialData: ModuleManagerData
  mode: ViewMode
  selectedCloudKey?: string
  selectedAppKey?: string
}) {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()
  const [activeCloud, setActiveCloud] = useState(selectedCloudKey || initialData.selectedCloudKey)
  const [activeApp, setActiveApp] = useState(selectedAppKey || initialData.selectedAppKey)
  const { clouds, apps, modules, orgClouds, orgApps, orgModules, pendingChanges, recentlyChanged } = useModuleStore((state) => state)
  const hydrate = useModuleStore((state) => state.hydrate)
  const toggleCloud = useModuleStore((state) => state.toggleCloud)
  const toggleApp = useModuleStore((state) => state.toggleApp)
  const toggleModule = useModuleStore((state) => state.toggleModule)
  const getModulesForCloud = useModuleStore((state) => state.getModulesForCloud)
  const getModulesForApp = useModuleStore((state) => state.getModulesForApp)

  useEffect(() => {
    hydrate(initialData)
  }, [hydrate, initialData])

  const enabledCloudCount = useMemo(() => Object.values(orgClouds).filter(Boolean).length, [orgClouds])
  const enabledAppCount = useMemo(() => Object.values(orgApps).filter(Boolean).length, [orgApps])
  const enabledModuleCount = useMemo(() => Object.values(orgModules).filter(Boolean).length, [orgModules])
  const selectedCloudModules = useMemo(() => getModulesForCloud(activeCloud), [activeCloud, getModulesForCloud, modules])
  const selectedAppModules = useMemo(() => getModulesForApp(activeApp), [activeApp, getModulesForApp, modules])

  const filteredCloudModules = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return selectedCloudModules
    return selectedCloudModules.filter((moduleItem) => moduleItem.module_name.toLowerCase().includes(needle) || moduleItem.module_key.includes(needle))
  }, [query, selectedCloudModules])

  const filteredAppModules = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return selectedAppModules
    return selectedAppModules.filter((moduleItem) => moduleItem.module_name.toLowerCase().includes(needle) || moduleItem.module_key.includes(needle))
  }, [query, selectedAppModules])

  function safeToggleModule(moduleKey: string, enabled: boolean) {
    startTransition(() => {
      toggleModule(moduleKey, enabled)
        .then(() => toast.success(`Module ${enabled ? 'enabled' : 'disabled'}.`))
        .catch((error) => toast.error(error.message))
    })
  }

  function safeToggleCloud(cloudKey: string, enabled: boolean) {
    startTransition(() => {
      toggleCloud(cloudKey, enabled)
        .then(() => toast.success(`Cloud ${enabled ? 'enabled' : 'disabled'}.`))
        .catch((error) => toast.error(error.message))
    })
  }

  function safeToggleApp(appKey: string, enabled: boolean) {
    startTransition(() => {
      toggleApp(appKey, enabled)
        .then(() => toast.success(`App ${enabled ? 'enabled' : 'disabled'}.`))
        .catch((error) => toast.error(error.message))
    })
  }

  if (mode === 'landing') {
    return (
      <div className="stack">
        <section className="grid">
          <Card>
            <h2>Industry Clouds</h2>
            <p>Enable modules based on your industry vertical.</p>
            <p className="meta">{clouds.length} clouds available</p>
            <Link href="/system-setup/modules/clouds"><Button>View Clouds</Button></Link>
          </Card>
          <Card>
            <h2>Functional Apps</h2>
            <p>Enable modules based on business function.</p>
            <p className="meta">{apps.length} apps available</p>
            <Link href="/system-setup/modules/apps"><Button>View Apps</Button></Link>
          </Card>
        </section>
        <Card>
          <h3>Currently Enabled</h3>
          <div className="badges">
            <Badge variant="success">{enabledCloudCount} Clouds</Badge>
            <Badge variant="success">{enabledAppCount} Apps</Badge>
            <Badge variant="success">{enabledModuleCount} Modules</Badge>
          </div>
        </Card>
      </div>
    )
  }

  if (mode === 'clouds') {
    const selectedCloud = clouds.find((cloud) => cloud.cloud_key === activeCloud) ?? clouds[0]
    return (
      <div className="cloud-layout">
        <aside>
          <h3>Industry Clouds</h3>
          <div className="list">
            {clouds.map((cloud) => (
              <button key={cloud.cloud_key} className={activeCloud === cloud.cloud_key ? 'active' : ''} onClick={() => setActiveCloud(cloud.cloud_key)}>
                <strong>{cloud.cloud_name}</strong>
                <small>{getModulesForCloud(cloud.cloud_key).length} modules</small>
              </button>
            ))}
          </div>
        </aside>
        <main>
          <Card>
            <div className="row">
              <div>
                <h2>{selectedCloud?.cloud_name}</h2>
                <p>{selectedCloud?.description}</p>
              </div>
              <Button
                variant={orgClouds[selectedCloud?.cloud_key ?? ''] ? 'outline' : 'primary'}
                onClick={() => safeToggleCloud(selectedCloud.cloud_key, !orgClouds[selectedCloud.cloud_key])}
                disabled={isPending}
              >
                {orgClouds[selectedCloud?.cloud_key ?? ''] ? 'Disable Cloud' : 'Enable Cloud'}
              </Button>
            </div>
          </Card>
          <Card>
            <div className="row">
              <Input placeholder="Search modules..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <div className="modules">
              {filteredCloudModules.map((moduleItem) => {
                const enabled = Boolean(orgModules[moduleItem.module_key])
                return (
                  <div className={`module-card ${enabled ? 'on' : 'off'}`} key={moduleItem.module_key}>
                    <div>
                      <strong>{moduleItem.module_name}</strong>
                      <small>{moduleItem.description}</small>
                    </div>
                    <Button
                      size="sm"
                      variant={enabled ? 'outline' : 'primary'}
                      disabled={moduleItem.is_core || isPending}
                      onClick={() => safeToggleModule(moduleItem.module_key, !enabled)}
                    >
                      {moduleItem.is_core ? 'Core' : enabled ? 'On' : 'Off'}
                    </Button>
                  </div>
                )
              })}
            </div>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="stack">
      <Card>
        <div className="tabs">
          {apps.map((app) => (
            <button className={activeApp === app.app_key ? 'active' : ''} key={app.app_key} onClick={() => setActiveApp(app.app_key)}>
              {app.app_name}
              <Badge variant="slate">{getModulesForApp(app.app_key).filter((moduleItem) => orgModules[moduleItem.module_key]).length}</Badge>
            </button>
          ))}
        </div>
      </Card>
      <Card>
        <div className="row">
          <Input placeholder="Search modules..." value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="actions">
            <Button size="sm" variant="outline" onClick={() => safeToggleApp(activeApp, false)} disabled={isPending}>Disable All</Button>
            <Button size="sm" onClick={() => safeToggleApp(activeApp, true)} disabled={isPending}>Enable All</Button>
          </div>
        </div>
        <div className="modules">
          {filteredAppModules.map((moduleItem) => {
            const enabled = Boolean(orgModules[moduleItem.module_key])
            return (
              <div className={`module-card ${enabled ? 'on' : 'off'}`} key={moduleItem.module_key}>
                <div>
                  <strong>{moduleItem.module_name}</strong>
                  <small>{moduleItem.description}</small>
                </div>
                <Button
                  size="sm"
                  variant={enabled ? 'outline' : 'primary'}
                  disabled={moduleItem.is_core || isPending}
                  onClick={() => safeToggleModule(moduleItem.module_key, !enabled)}
                >
                  {moduleItem.is_core ? 'Core' : enabled ? 'On' : 'Off'}
                </Button>
              </div>
            )
          })}
        </div>
      </Card>
      {(pendingChanges > 0 || recentlyChanged.length > 0) && (
        <Card>
          <p>{pendingChanges > 0 ? `${pendingChanges} pending changes...` : 'All changes saved.'}</p>
        </Card>
      )}
      <style jsx>{`
        .stack {
          display: grid;
          gap: var(--space-4);
        }
        .grid {
          display: grid;
          gap: var(--space-4);
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .meta {
          color: var(--text-secondary);
          font-size: var(--text-sm);
          margin-bottom: var(--space-3);
        }
        .badges {
          display: flex;
          gap: var(--space-2);
        }
        .cloud-layout {
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr);
          gap: var(--space-4);
        }
        aside .list {
          display: grid;
          gap: var(--space-2);
          margin-top: var(--space-3);
        }
        aside button {
          text-align: left;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--surface-card);
          padding: var(--space-3);
          display: grid;
          gap: var(--space-1);
        }
        aside button.active {
          border-color: var(--color-primary-500);
          background: var(--color-primary-50);
        }
        .row {
          display: flex;
          justify-content: space-between;
          gap: var(--space-3);
          align-items: center;
        }
        .actions {
          display: flex;
          gap: var(--space-2);
        }
        .modules {
          margin-top: var(--space-3);
          display: grid;
          gap: var(--space-2);
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .module-card {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          padding: var(--space-3);
          display: flex;
          justify-content: space-between;
          gap: var(--space-3);
        }
        .module-card.on {
          background: #f0fdf4;
        }
        .module-card.off {
          background: #f8fafc;
        }
        .module-card small {
          color: var(--text-secondary);
          display: block;
          margin-top: var(--space-1);
        }
        .tabs {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }
        .tabs button {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-full);
          padding: 8px 12px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: white;
        }
        .tabs button.active {
          border-color: var(--color-primary-500);
          background: var(--color-primary-50);
        }
        @media (max-width: 900px) {
          .grid,
          .cloud-layout,
          .modules {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
