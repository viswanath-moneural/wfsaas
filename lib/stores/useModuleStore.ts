'use client'

import { create } from 'zustand'
import type { AppDefinition, CloudDefinition, ModuleDefinition } from '@/lib/moduleManager'
import { saveModuleConfig, toggleApp, toggleCloud, toggleModule } from '@/app/actions/systemSetup/modules'

type ModuleStore = {
  clouds: CloudDefinition[]
  apps: AppDefinition[]
  modules: ModuleDefinition[]
  orgClouds: Record<string, boolean>
  orgApps: Record<string, boolean>
  orgModules: Record<string, boolean>
  moduleConfigs: Record<string, any>
  recentlyChanged: Array<{ moduleKey: string; at: number }>
  pendingChanges: number
  hydrate: (payload: {
    clouds: CloudDefinition[]
    apps: AppDefinition[]
    modules: ModuleDefinition[]
    orgClouds: Record<string, boolean>
    orgApps: Record<string, boolean>
    orgModules: Record<string, boolean>
    moduleConfigs: Record<string, any>
  }) => void
  toggleCloud: (cloudKey: string, enabled: boolean) => Promise<void>
  toggleApp: (appKey: string, enabled: boolean) => Promise<void>
  toggleModule: (moduleKey: string, enabled: boolean) => Promise<void>
  saveModuleConfig: (moduleKey: string, config: any) => Promise<void>
  isModuleEnabled: (moduleKey: string) => boolean
  getModulesForCloud: (cloudKey: string) => ModuleDefinition[]
  getModulesForApp: (appKey: string) => ModuleDefinition[]
  getEnabledModuleKeys: () => string[]
}

export const useModuleStore = create<ModuleStore>((set, get) => ({
  clouds: [],
  apps: [],
  modules: [],
  orgClouds: {},
  orgApps: {},
  orgModules: {},
  moduleConfigs: {},
  recentlyChanged: [],
  pendingChanges: 0,
  hydrate: (payload) => set(() => ({ ...payload })),
  toggleCloud: async (cloudKey, enabled) => {
    set((state) => ({ orgClouds: { ...state.orgClouds, [cloudKey]: enabled }, pendingChanges: state.pendingChanges + 1 }))
    const result = await toggleCloud(cloudKey, enabled)
    if (result.error) throw new Error(result.error)
    const now = Date.now()
    set((state) => {
      const touchedModules = state.modules.filter((moduleItem) => moduleItem.cloud_keys.includes(cloudKey))
      const nextOrgModules = { ...state.orgModules }
      touchedModules.forEach((moduleItem) => {
        if (!moduleItem.is_core) nextOrgModules[moduleItem.module_key] = enabled
      })
      return {
        orgModules: nextOrgModules,
        pendingChanges: Math.max(0, state.pendingChanges - 1),
        recentlyChanged: touchedModules.map((moduleItem) => ({ moduleKey: moduleItem.module_key, at: now })).slice(0, 20),
      }
    })
  },
  toggleApp: async (appKey, enabled) => {
    set((state) => ({ orgApps: { ...state.orgApps, [appKey]: enabled }, pendingChanges: state.pendingChanges + 1 }))
    const result = await toggleApp(appKey, enabled)
    if (result.error) throw new Error(result.error)
    const now = Date.now()
    set((state) => {
      const touchedModules = state.modules.filter((moduleItem) => moduleItem.app_keys.includes(appKey))
      const nextOrgModules = { ...state.orgModules }
      touchedModules.forEach((moduleItem) => {
        if (!moduleItem.is_core) nextOrgModules[moduleItem.module_key] = enabled
      })
      return {
        orgModules: nextOrgModules,
        pendingChanges: Math.max(0, state.pendingChanges - 1),
        recentlyChanged: touchedModules.map((moduleItem) => ({ moduleKey: moduleItem.module_key, at: now })).slice(0, 20),
      }
    })
  },
  toggleModule: async (moduleKey, enabled) => {
    set((state) => ({ orgModules: { ...state.orgModules, [moduleKey]: enabled }, pendingChanges: state.pendingChanges + 1 }))
    const result = await toggleModule(moduleKey, enabled)
    if (result.error) throw new Error(result.error)
    set((state) => ({
      pendingChanges: Math.max(0, state.pendingChanges - 1),
      recentlyChanged: [{ moduleKey, at: Date.now() }, ...state.recentlyChanged].slice(0, 20),
    }))
  },
  saveModuleConfig: async (moduleKey, config) => {
    const result = await saveModuleConfig(moduleKey, config)
    if (result.error) throw new Error(result.error)
    set((state) => ({ moduleConfigs: { ...state.moduleConfigs, [moduleKey]: config } }))
  },
  isModuleEnabled: (moduleKey) => Boolean(get().orgModules[moduleKey]),
  getModulesForCloud: (cloudKey) => get().modules.filter((moduleItem) => moduleItem.cloud_keys.includes(cloudKey)),
  getModulesForApp: (appKey) => get().modules.filter((moduleItem) => moduleItem.app_keys.includes(appKey)),
  getEnabledModuleKeys: () => Object.entries(get().orgModules).filter(([, enabled]) => enabled).map(([moduleKey]) => moduleKey),
}))
