'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { isPrivilegedRole } from '@/lib/auth/isPrivilegedRole'
import type { UserPermissions } from '@/lib/permissions'

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------
export interface Organisation {
  id: string
  name: string
  slug: string
  country: string
  timezone: string
  is_active: boolean
}

export interface Tenant {
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
  tenant_id: string | null
}

export interface AuthState {
  user:        CurrentUser | null
  org:         Organisation | null
  tenant:      Tenant | null
  allTenants:  Tenant[]          // All tenants in this org (for switcher)
  permissions: UserPermissions | null
  isLoading:   boolean
  isAuthenticated: boolean
}

interface AuthContextValue extends AuthState {
  signOut:       () => Promise<void>
  switchTenant:  (tenantId: string) => Promise<void>
  refreshAuth:   () => Promise<void>
}

// ----------------------------------------------------------
// Context
// ----------------------------------------------------------
const AuthContext = createContext<AuthContextValue | null>(null)

// ----------------------------------------------------------
// Provider
// ----------------------------------------------------------
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user:            null,
    org:             null,
    tenant:          null,
    allTenants:      [],
    permissions:     null,
    isLoading:       true,
    isAuthenticated: false,
  })

  const [supabase, setSupabase] = useState<ReturnType<typeof getSupabaseClient> | null>(null)

  useEffect(() => {
    setSupabase(getSupabaseClient())
  }, [])

  const loadUserData = useCallback(async (userId: string) => {
    if (!supabase) return

    try {
      // 1. Load user record
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (userError || !userData) throw userError

      const baseRole = String(userData.role ?? '').toLowerCase()
      const isBasePrivileged = isPrivilegedRole(baseRole)

      // 2. Load organisation (privileged fallback if org_id is missing)
      let orgData: Organisation | null = null
      if (userData.org_id) {
        const { data: orgById } = await supabase
          .from('organisations')
          .select('*')
          .eq('id', userData.org_id)
          .maybeSingle()
        orgData = (orgById as Organisation | null) ?? null
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

      // 3. Load tenants for this org
      const effectiveOrgId = (orgData?.id ?? userData.org_id) as string | null

      const { data: tenantsData } = await supabase
        .from('tenants')
        .select('*')
        .eq('org_id', effectiveOrgId ?? '')
        .eq('is_active', true)
        .order('name')

      const allTenants = tenantsData ?? []

      // 4. Determine active tenant
      const storedTenantId = typeof window !== 'undefined'
        ? localStorage.getItem(`active_tenant_${effectiveOrgId ?? userData.org_id}`)
        : null

      const activeTenant = allTenants.find(t =>
        t.id === (storedTenantId ?? userData.tenant_id)
      ) ?? allTenants[0] ?? null

      // 5. Load enabled modules for this org
      const { data: modulesData } = await supabase
        .from('org_modules')
        .select('module_key, is_enabled')
        .eq('org_id', effectiveOrgId ?? '')

      const enabledModules = (modulesData ?? [])
        .filter(m => m.is_enabled)
        .map(m => m.module_key)

      // Always include dashboard and configuration
      if (!enabledModules.includes('dashboard'))     enabledModules.push('dashboard')
      if (!enabledModules.includes('configuration')) enabledModules.push('configuration')

      // 6. Load role permissions
      const { data: userRoleData } = await supabase
        .from('user_roles')
        .select(`
          role_id,
          roles ( role_name, is_system ),
          role_permissions: role_permissions ( module_key, can_create, can_read, can_update, can_delete )
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle()

      const roleName = (userRoleData?.roles as any)?.role_name ?? userData.role
      const appRole = String(userData.role ?? '').toLowerCase()
      const resolvedRole = String(roleName ?? '').toLowerCase()
      const isAdmin = isPrivilegedRole(appRole) || isPrivilegedRole(resolvedRole)

      const modulePermissions: Record<string, any> = {}
      ;((userRoleData as any)?.role_permissions ?? []).forEach((rp: any) => {
        modulePermissions[rp.module_key] = rp
      })

      // 7. Load field permissions for this role
      const { data: fieldPermsData } = await supabase
        .from('field_permissions')
        .select('table_name, field_name, can_view, can_edit')
        .eq('role_id', userRoleData?.role_id ?? '')

      setState({
        user: userData as CurrentUser,
        org:  (orgData as Organisation | null) ?? null,
        tenant: activeTenant as Tenant,
        allTenants: allTenants as Tenant[],
        permissions: {
          role_name:          roleName,
          is_admin:           isAdmin,
          module_permissions: modulePermissions,
          field_permissions:  fieldPermsData ?? [],
          enabled_modules:    enabledModules,
        },
        isLoading:       false,
        isAuthenticated: true,
      })
    } catch (err) {
      console.error('[AuthContext] Failed to load user data:', err)
      setState(prev => ({ ...prev, isLoading: false, isAuthenticated: false }))
    }
  }, [supabase])

  const refreshAuth = useCallback(async () => {
    if (!supabase) return

    const { data: { user } } = await supabase.auth.getUser()
    if (user) await loadUserData(user.id)
  }, [supabase, loadUserData])

  useEffect(() => {
    if (!supabase) return

    // Initial session check
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        loadUserData(user.id)
      } else {
        setState(prev => ({ ...prev, isLoading: false }))
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUserData(session.user.id)
      } else {
        setState({
          user: null, org: null, tenant: null, allTenants: [],
          permissions: null, isLoading: false, isAuthenticated: false,
        })
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, loadUserData])

  const signOut = useCallback(async () => {
    if (!supabase) return
    try {
      await supabase.auth.signOut({ scope: 'global' })
    } catch (err) {
      console.error('[AuthContext] signOut failed:', err)
    } finally {
      if (typeof window !== 'undefined') {
        Object.keys(localStorage)
          .filter((key) => key.startsWith('active_tenant_'))
          .forEach((key) => localStorage.removeItem(key))
      }
      setState({
        user: null,
        org: null,
        tenant: null,
        allTenants: [],
        permissions: null,
        isLoading: false,
        isAuthenticated: false,
      })
    }
  }, [supabase])

  const switchTenant = useCallback(async (tenantId: string) => {
    const tenant = state.allTenants.find(t => t.id === tenantId)
    if (!tenant) return

    if (state.org) {
      localStorage.setItem(`active_tenant_${state.org.id}`, tenantId)
    }
    setState(prev => ({ ...prev, tenant }))
  }, [state.allTenants, state.org])

  return (
    <AuthContext.Provider value={{ ...state, signOut, switchTenant, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

// ----------------------------------------------------------
// Hooks
// ----------------------------------------------------------
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function useUser()   { return useAuth().user }
export function useOrg()    { return useAuth().org }
export function useTenant() { return useAuth().tenant }
