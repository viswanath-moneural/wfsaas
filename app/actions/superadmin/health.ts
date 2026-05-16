'use server'

import { createClient as createSessionClient } from '@/lib/supabase.server'
import { getSuperadminContext } from '@/lib/auth/getSuperadminContext'
import { requireSuperadmin } from '@/lib/auth/requireSuperadmin'
import { createAdminClient } from '@/lib/supabase/adminClient'
import { fail, ok, writeAuditLog, type SuperadminActionResult } from './_shared'
import * as organisationActions from './organisations'
import * as userActions from './users'
import * as permissionActions from './permissions'

export interface HealthCheckResult {
  id: string
  group: 'DATABASE CHECKS' | 'AUTH CHECKS' | 'SERVER ACTION CHECKS'
  label: string
  passed: boolean
  message: string
}

async function check(
  group: HealthCheckResult['group'],
  id: string,
  label: string,
  fn: () => Promise<string | void>
): Promise<HealthCheckResult> {
  try {
    const message = await fn()
    return { id, group, label, passed: true, message: message || 'OK' }
  } catch (error) {
    return {
      id,
      group,
      label,
      passed: false,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

async function assertTableReadable(admin: ReturnType<typeof createAdminClient>, tableName: string) {
  const { error } = await (admin as any).from(tableName).select('*').limit(1)
  if (error) throw error
}

async function assertSessionReadable(sessionClient: Awaited<ReturnType<typeof createSessionClient>>, tableName: string) {
  const { error } = await (sessionClient as any).from(tableName).select('*').limit(1)
  if (error) throw error
}

export async function runHealthChecks(): Promise<SuperadminActionResult<HealthCheckResult[]>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const sessionClient = await createSessionClient()
    const superadminEmail = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase()

    const results = await Promise.all([
      check('DATABASE CHECKS', 'superadmin-role', 'superadmin role exists in roles table', async () => {
        const { data, error } = await admin.from('roles').select('id').eq('role_name', 'superadmin').limit(1)
        if (error) throw error
        if (!data?.length) throw new Error('No role_name=superadmin row found.')
      }),
      check('DATABASE CHECKS', 'permissions-wildcard', 'permissions table exists with wildcard superadmin row', async () => {
        await assertTableReadable(admin, 'permissions')
        const { data: roles, error: roleError } = await admin.from('roles').select('id').eq('role_name', 'superadmin')
        if (roleError) throw roleError
        const roleIds = (roles ?? []).map((role: any) => role.id)
        if (!roleIds.length) throw new Error('No superadmin role ids found.')
        const { data, error } = await admin
          .from('permissions')
          .select('id')
          .eq('module_key', '*')
          .eq('can_view', true)
          .eq('can_create', true)
          .eq('can_edit', true)
          .eq('can_delete', true)
          .in('role_id', roleIds)
          .limit(1)
        if (error) throw error
        if (!data?.length) throw new Error('Wildcard superadmin permissions row not found.')
      }),
      check('DATABASE CHECKS', 'audit-log-table', 'audit_log table exists', async () => {
        await assertTableReadable(admin, 'audit_log')
      }),
      check('DATABASE CHECKS', 'is-superadmin-function', 'is_superadmin() DB function exists', async () => {
        const { data, error } = await admin.rpc('is_superadmin', { user_id: verified.userId })
        if (error) throw error
        if (data !== true) throw new Error('Function exists but did not return true for current superadmin.')
      }),
      ...[
        ['users', 'users'],
        ['organisations', 'organisations'],
        ['factories', 'tenants'],
        ['sales_orders', 'sales_orders'],
        ['purchase_orders', 'purchase_orders'],
        ['inventory_items', 'inventory_items'],
      ].map(([labelName, tableName]) => check('DATABASE CHECKS', `rls-${labelName}`, `RLS policies include superadmin bypass on ${labelName}`, async () => {
        await assertSessionReadable(sessionClient, tableName)
      })),
      check('AUTH CHECKS', 'env-superadmin-email', 'SUPERADMIN_EMAIL env var is set', async () => {
        if (!superadminEmail) throw new Error('SUPERADMIN_EMAIL is missing.')
      }),
      check('AUTH CHECKS', 'auth-superadmin-user', 'Superadmin Auth user exists in auth.users', async () => {
        if (!superadminEmail) throw new Error('SUPERADMIN_EMAIL is missing.')
        const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        if (error) throw error
        const authUser = data.users.find((user) => user.email?.toLowerCase() === superadminEmail)
        if (!authUser) throw new Error(`No Supabase Auth user found for ${superadminEmail}.`)
      }),
      check('AUTH CHECKS', 'public-superadmin-user', 'Superadmin public.users row exists and links to auth user', async () => {
        if (!superadminEmail) throw new Error('SUPERADMIN_EMAIL is missing.')
        const { data: authUsers, error: authError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        if (authError) throw authError
        const authUser = authUsers.users.find((user) => user.email?.toLowerCase() === superadminEmail)
        if (!authUser) throw new Error(`No Supabase Auth user found for ${superadminEmail}.`)
        const { data, error } = await admin.from('users').select('id, email, role').eq('id', authUser.id).maybeSingle()
        if (error) throw error
        if (!data) throw new Error('Auth user exists, but matching public.users row is missing.')
      }),
      check('AUTH CHECKS', 'superadmin-user-roles', 'Superadmin user_roles row exists', async () => {
        const { data, error } = await admin
          .from('user_roles')
          .select('id, roles(role_name)')
          .eq('user_id', verified.userId)
          .eq('is_active', true)
        if (error) throw error
        if (!(data ?? []).some((row: any) => row.roles?.role_name === 'superadmin')) {
          throw new Error('Current superadmin has no active user_roles row linked to superadmin role.')
        }
      }),
      check('SERVER ACTION CHECKS', 'action-create-org', 'createOrganisation action reachable', async () => {
        if (typeof organisationActions.createWithSetup !== 'function') throw new Error('createWithSetup action is not exported.')
      }),
      check('SERVER ACTION CHECKS', 'action-create-user', 'createUser action reachable', async () => {
        if (typeof userActions.create !== 'function') throw new Error('create user action is not exported.')
      }),
      check('SERVER ACTION CHECKS', 'action-bulk-update-permissions', 'bulkUpdatePermissions action reachable', async () => {
        if (typeof permissionActions.bulkUpdate !== 'function') throw new Error('bulkUpdate action is not exported.')
      }),
      check('SERVER ACTION CHECKS', 'action-audit-write', 'auditLog write works', async () => {
        await writeAuditLog({
          admin,
          actor: verified,
          orgId: verified.orgId,
          tableName: 'health_check',
          recordId: verified.userId,
          action: 'health.check',
          oldData: null,
          newData: { checked_at: new Date().toISOString() },
          entityName: 'Superadmin health check',
        })
      }),
    ])

    return ok(results)
  } catch (error) {
    return fail(error)
  }
}
