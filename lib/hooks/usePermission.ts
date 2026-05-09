// ============================================================
// PERMISSION SYSTEM
// ============================================================

export type Action = 'create' | 'read' | 'update' | 'delete'

export interface ModulePermission {
  module_key: string
  can_create: boolean
  can_read:   boolean
  can_update: boolean
  can_delete: boolean
}

export interface FieldPermission {
  table_name: string
  field_name: string
  can_view:   boolean
  can_edit:   boolean
}

export interface UserPermissions {
  role_name:         string
  is_admin:          boolean
  module_permissions: Record<string, ModulePermission>
  field_permissions:  FieldPermission[]
  enabled_modules:    string[]   // from org_modules
}

// ----------------------------------------------------------
// Default permissions per system role
// These are the SEED values — stored in DB, can be customised
// ----------------------------------------------------------
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Partial<Record<string, Omit<ModulePermission, 'module_key'>>>> = {
  admin: {
    // Admin gets full access to everything
    '*': { can_create: true, can_read: true, can_update: true, can_delete: true },
  },
  ceo: {
    dashboard:     { can_create: false, can_read: true, can_update: false, can_delete: false },
    sales:         { can_create: false, can_read: true, can_update: false, can_delete: false },
    purchases:     { can_create: false, can_read: true, can_update: false, can_delete: false },
    manufacturing: { can_create: false, can_read: true, can_update: false, can_delete: false },
    inventory:     { can_create: false, can_read: true, can_update: false, can_delete: false },
    crm:           { can_create: false, can_read: true, can_update: false, can_delete: false },
    hr:            { can_create: false, can_read: true, can_update: false, can_delete: false },
    reports:       { can_create: true,  can_read: true, can_update: true,  can_delete: false },
  },
  manager: {
    dashboard:     { can_create: false, can_read: true,  can_update: false, can_delete: false },
    sales:         { can_create: true,  can_read: true,  can_update: true,  can_delete: false },
    purchases:     { can_create: true,  can_read: true,  can_update: true,  can_delete: false },
    manufacturing: { can_create: true,  can_read: true,  can_update: true,  can_delete: false },
    inventory:     { can_create: true,  can_read: true,  can_update: true,  can_delete: false },
    crm:           { can_create: true,  can_read: true,  can_update: true,  can_delete: false },
    hr:            { can_create: true,  can_read: true,  can_update: true,  can_delete: false },
    reports:       { can_create: true,  can_read: true,  can_update: true,  can_delete: false },
  },
  salesperson: {
    dashboard:     { can_create: false, can_read: true,  can_update: false, can_delete: false },
    sales:         { can_create: true,  can_read: true,  can_update: true,  can_delete: false },
    crm:           { can_create: true,  can_read: true,  can_update: true,  can_delete: false },
    inventory:     { can_create: false, can_read: true,  can_update: false, can_delete: false },
    reports:       { can_create: false, can_read: true,  can_update: false, can_delete: false },
  },
  accountant: {
    dashboard:     { can_create: false, can_read: true,  can_update: false, can_delete: false },
    sales:         { can_create: false, can_read: true,  can_update: true,  can_delete: false },
    purchases:     { can_create: false, can_read: true,  can_update: true,  can_delete: false },
    hr:            { can_create: false, can_read: true,  can_update: false, can_delete: false },
    reports:       { can_create: true,  can_read: true,  can_update: true,  can_delete: false },
  },
  operator: {
    dashboard:     { can_create: false, can_read: true,  can_update: false, can_delete: false },
    manufacturing: { can_create: true,  can_read: true,  can_update: true,  can_delete: false },
    inventory:     { can_create: false, can_read: true,  can_update: false, can_delete: false },
  },
}

// ----------------------------------------------------------
// Permission check helpers
// ----------------------------------------------------------

export function hasModuleAccess(
  permissions: UserPermissions,
  moduleKey: string,
  action: Action = 'read'
): boolean {
  if (permissions.is_admin) return true

  // Check if module is enabled for org
  if (!permissions.enabled_modules.includes(moduleKey)) return false

  const mp = permissions.module_permissions[moduleKey]
  if (!mp) return false

  switch (action) {
    case 'create': return mp.can_create
    case 'read':   return mp.can_read
    case 'update': return mp.can_update
    case 'delete': return mp.can_delete
  }
}

export function hasFieldAccess(
  permissions: UserPermissions,
  tableName: string,
  fieldName: string,
  mode: 'view' | 'edit' = 'view'
): boolean {
  if (permissions.is_admin) return true

  const fp = permissions.field_permissions.find(
    f => f.table_name === tableName && f.field_name === fieldName
  )

  // If no field permission defined, default to allow view, deny edit
  if (!fp) return mode === 'view'

  return mode === 'view' ? fp.can_view : fp.can_edit
}

export function canAccessModule(permissions: UserPermissions, moduleKey: string): boolean {
  return hasModuleAccess(permissions, moduleKey, 'read')
}