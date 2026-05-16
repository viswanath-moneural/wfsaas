export function isPrivilegedRole(role: string | null | undefined) {
  const normalizedRole = String(role ?? '').trim().toLowerCase()
  return normalizedRole === 'superadmin' || normalizedRole === 'owner' || normalizedRole === 'admin'
}
