'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'
import { isPrivilegedRole } from '@/lib/auth/isPrivilegedRole'
import type { UserPermissions } from '@/lib/permissions'

export interface Organisation {
  id: string
  name: string
  slug: string
  country: string
  timezone: string
  is_active: boolean
}

export interface BusinessUnit {
  id: string
  name: string
  phone: string
  org_id: string
  is_active: boolean
}

export interface CurrentUser {
  id: string
  email: string
  full_name: string
  phone: string
  role: string
  is_active: boolean
  org_id: string
  business_unit_id: string | null
}

export interface AuthState {
  user: CurrentUser | null
  org: Organisation | null
  allOrganisations: Organisation[]
  businessUnit: BusinessUnit | null
  businessUnits: BusinessUnit[]
  permissions: UserPermissions | null
  isLoading: boolean
  isAuthenticated: boolean
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>
  switchBusinessUnit: (businessUnitId: string) => Promise<void>
  switchOrgContext: (orgId: string) => Promise<void>
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [state, setState] = useState<AuthState>({
    user: null,
    org: null,
    allOrganisations: [],
    businessUnit: null,
    businessUnits: [],
    permissions: null,
    isLoading: true,
    isAuthenticated: false,
  })

  const [supabase, setSupabase] = useState<ReturnType<typeof getSupabaseClient> | null>(null)

  useEffect(() => {
    setSupabase(getSupabaseClient())
  }, [])

  const loadUserData = useCallback(async (userId: string) => {
    if (!supabase) return

    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (userError || !userData) throw userError

      const baseRole = String(userData.role ?? '').toLowerCase()
      const isBasePrivileged = isPrivilegedRole(baseRole)
      const isBaseSuperadmin = baseRole === 'superadmin'

      let orgData: Organisation | null = null
      let allOrganisations: Organisation[] = []

      if (isBaseSuperadmin) {
        const { data: allOrgRows } = await supabase
          .from('organisations')
          .select('*')
          .order('name')
        allOrganisations = (allOrgRows ?? []) as Organisation[]
      }

      if (userData.org_id) {
        const { data: orgById } = await supabase
          .from('organisations')
          .select('*')
          .eq('id', userData.org_id)
          .maybeSingle()
        orgData = (orgById as Organisation | null) ?? null
      }

      if (isBaseSuperadmin && typeof window !== 'undefined') {
        const storedOrgId = localStorage.getItem('superadmin_view_org')
        const storedOrg = allOrganisations.find((org) => org.id === storedOrgId)
        if (storedOrg) orgData = storedOrg
      }

      if (!orgData && isBasePrivileged) {
        const { data: preferredOrg } = await supabase
          .from('organisations')
          .select('*')
          .eq('slug', 'wfsaas-platform')
          .maybeSingle()

        if (preferredOrg) {
          orgData = preferredOrg as Organisation
        } else {
          const { data: firstOrg } = await supabase
            .from('organisations')
            .select('*')
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle()
          orgData = (firstOrg as Organisation | null) ?? null
        }
      }

      const effectiveOrgId = (orgData?.id ?? userData.org_id) as string | null

      const { data: businessUnitsData } = await supabase
        .from('business_units')
        .select('*')
        .eq('org_id', effectiveOrgId ?? '')
        .eq('is_active', true)
        .order('name')

      const businessUnits = (businessUnitsData ?? []) as BusinessUnit[]

      const storedBusinessUnitId = typeof window !== 'undefined'
        ? localStorage.getItem(`active_business_unit_${effectiveOrgId ?? userData.org_id}`)
        : null

      const activeBusinessUnit = businessUnits.find((item) =>
        item.id === (storedBusinessUnitId ?? userData.business_unit_id)
      ) ?? businessUnits[0] ?? null

      const { data: modulesData } = await supabase
        .from('org_modules')
        .select('module_key, is_enabled')
        .eq('org_id', effectiveOrgId ?? '')

      const enabledModules = (modulesData ?? [])
        .filter((moduleRow) => moduleRow.is_enabled)
        .map((moduleRow) => moduleRow.module_key)

      if (!enabledModules.includes('dashboard')) enabledModules.push('dashboard')
      if (!enabledModules.includes('configuration')) enabledModules.push('configuration')

      const { data: userRolesData } = await supabase
        .from('user_roles')
        .select(`
          role_id,
          roles ( role_name, is_system )
        `)
        .eq('user_id', userId)
        .eq('is_active', true)

      const userRoleData = userRolesData?.[0] as any
      const roleIds = (userRolesData ?? []).map((row: any) => row.role_id).filter(Boolean)

      const roleName = (userRoleData?.roles as any)?.role_name ?? userData.role
      const appRole = String(userData.role ?? '').toLowerCase()
      const resolvedRole = String(roleName ?? '').toLowerCase()
      const isAdmin = isPrivilegedRole(appRole) || isPrivilegedRole(resolvedRole)
      const isSuperadmin = appRole === 'superadmin' || resolvedRole === 'superadmin'

      const modulePermissions: Record<string, any> = {}
      if (isSuperadmin) {
        enabledModules.forEach((moduleKey) => {
          modulePermissions[moduleKey] = {
            module_key: moduleKey,
            can_view: true,
            can_create: true,
            can_edit: true,
            can_delete: true,
            can_export: true,
            can_approve: true,
            can_read: true,
            can_update: true,
            canView: true,
            canCreate: true,
            canEdit: true,
            canDelete: true,
            canExport: true,
            canApprove: true,
          }
        })
      } else if (roleIds.length) {
        const { data: permissionRows } = await (supabase as any)
          .from('permissions')
          .select('module_key, can_view, can_create, can_edit, can_delete, can_export, can_approve')
          .in('role_id', roleIds)

        const normalizedPermissionRows = ((permissionRows ?? []) as any[])
        if (!normalizedPermissionRows.length) {
          const { data: legacyPermissionRows } = await supabase
            .from('role_permissions')
            .select('module_key, can_create, can_read, can_update, can_delete')
            .in('role_id', roleIds)
          ;((legacyPermissionRows ?? []) as any[]).forEach((permission) => {
            normalizedPermissionRows.push({
              module_key: permission.module_key,
              can_view: permission.can_read,
              can_create: permission.can_create,
              can_edit: permission.can_update,
              can_delete: permission.can_delete,
              can_export: false,
              can_approve: false,
            })
          })
        }

        normalizedPermissionRows.forEach((permission) => {
          const current = modulePermissions[permission.module_key]
          modulePermissions[permission.module_key] = {
            module_key: permission.module_key,
            can_view: Boolean(current?.can_view || permission.can_view),
            can_create: Boolean(current?.can_create || permission.can_create),
            can_edit: Boolean(current?.can_edit || permission.can_edit),
            can_delete: Boolean(current?.can_delete || permission.can_delete),
            can_export: Boolean(current?.can_export || permission.can_export),
            can_approve: Boolean(current?.can_approve || permission.can_approve),
            can_read: Boolean(current?.can_read || permission.can_view),
            can_update: Boolean(current?.can_update || permission.can_edit),
            canView: Boolean(current?.canView || permission.can_view),
            canCreate: Boolean(current?.canCreate || permission.can_create),
            canEdit: Boolean(current?.canEdit || permission.can_edit),
            canDelete: Boolean(current?.canDelete || permission.can_delete),
            canExport: Boolean(current?.canExport || permission.can_export),
            canApprove: Boolean(current?.canApprove || permission.can_approve),
          }
        })
      }

      const { data: fieldPermsData } = await supabase
        .from('field_permissions')
        .select('table_name, field_name, can_view, can_edit')
        .eq('role_id', userRoleData?.role_id ?? '')

      setState({
        user: userData as CurrentUser,
        org: (orgData as Organisation | null) ?? null,
        allOrganisations,
        businessUnit: activeBusinessUnit,
        businessUnits,
        permissions: {
          role_name: roleName,
          is_admin: isAdmin,
          module_permissions: modulePermissions,
          permissions_map: modulePermissions,
          field_permissions: fieldPermsData ?? [],
          enabled_modules: enabledModules,
        },
        isLoading: false,
        isAuthenticated: true,
      })
    } catch (err) {
      console.error('[AuthContext] Failed to load user data:', err)
      setState((prev) => ({ ...prev, isLoading: false, isAuthenticated: false }))
    }
  }, [supabase])

  const refreshAuth = useCallback(async () => {
    if (!supabase) return

    const { data: { user } } = await supabase.auth.getUser()
    if (user) await loadUserData(user.id)
  }, [supabase, loadUserData])

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        loadUserData(user.id)
      } else {
        setState((prev) => ({ ...prev, isLoading: false }))
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUserData(session.user.id)
      } else {
        setState({
          user: null,
          org: null,
          businessUnit: null,
          businessUnits: [],
          allOrganisations: [],
          permissions: null,
          isLoading: false,
          isAuthenticated: false,
        })
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, loadUserData])

  useEffect(() => {
    if (state.isLoading || !state.isAuthenticated || !state.user) return
    if (!state.user.org_id && pathname !== '/system-setup') {
      router.replace('/system-setup')
    }
  }, [pathname, router, state.isAuthenticated, state.isLoading, state.user])

  const signOut = useCallback(async () => {
    if (!supabase) return
    try {
      await supabase.auth.signOut({ scope: 'global' })
    } catch (err) {
      console.error('[AuthContext] signOut failed:', err)
    } finally {
      if (typeof window !== 'undefined') {
        Object.keys(localStorage)
          .filter((key) => key.startsWith('active_business_unit_'))
          .forEach((key) => localStorage.removeItem(key))
      }
      setState({
        user: null,
        org: null,
        allOrganisations: [],
        businessUnit: null,
        businessUnits: [],
        permissions: null,
        isLoading: false,
        isAuthenticated: false,
      })
    }
  }, [supabase])

  const switchBusinessUnit = useCallback(async (businessUnitId: string) => {
    const businessUnit = state.businessUnits.find((item) => item.id === businessUnitId)
    if (!businessUnit) return

    if (state.org) {
      localStorage.setItem(`active_business_unit_${state.org.id}`, businessUnitId)
    }
    setState((prev) => ({ ...prev, businessUnit }))
  }, [state.businessUnits, state.org])

  const switchOrgContext = useCallback(async (orgId: string) => {
    if (!state.user) return
    if (typeof window !== 'undefined') {
      localStorage.setItem('superadmin_view_org', orgId)
    }
    await loadUserData(state.user.id)
  }, [loadUserData, state.user])

  return (
    <AuthContext.Provider value={{ ...state, signOut, switchBusinessUnit, switchOrgContext, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function useUser() { return useAuth().user }
export function useOrg() { return useAuth().org }
export function useBusinessUnit() { return useAuth().businessUnit }




