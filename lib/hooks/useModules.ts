'use client'

import { useMemo } from 'react'
import { useModuleStore } from '@/lib/stores/useModuleStore'

type NavItem = { moduleKey?: string }

export function useModules() {
  const orgModules = useModuleStore((state) => state.orgModules)

  const isEnabled = useMemo(
    () => (moduleKey: string) => orgModules[moduleKey] ?? false,
    [orgModules]
  )

  const filterNavItems = useMemo(
    () => (items: NavItem[]) => items.filter((item) => !item.moduleKey || isEnabled(item.moduleKey)),
    [isEnabled]
  )

  return { isEnabled, filterNavItems }
}
