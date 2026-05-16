'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { adminProfiles, adminUsers } from '@/app/actions/admin'

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

export default function ProfilesAdminClient({ initialProfiles, userCounts, lookups }: { initialProfiles: any[]; userCounts: Record<string, number>; lookups: any }) {
  const router = useRouter()
  const [profiles, setProfiles] = useState(initialProfiles)
  const [counts, setCounts] = useState(userCounts)
  const [query, setQuery] = useState('')
  const [panel, setPanel] = useState<{ mode: 'create' | 'edit' | 'clone'; profile?: any } | null>(null)
  const [form, setForm] = useState({ label: '', name: '', description: '', org_id: lookups.currentUser?.org_id ?? '', clone_from: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isPending, startTransition] = useTransition()
  const isSuperadmin = lookups.currentUser?.is_superadmin === true

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    return profiles.filter((profile) => !search || profile.label?.toLowerCase().includes(search) || profile.name?.toLowerCase().includes(search))
  }, [profiles, query])

  function refresh() {
    startTransition(async () => {
      const [profileResult, userResult] = await Promise.all([adminProfiles.getAll(), adminUsers.getAll()])
      if (profileResult.data) setProfiles(profileResult.data)
      if (userResult.data) {
        const next = userResult.data.reduce((acc: Record<string, number>, user: any) => {
          if (user.profile_id) acc[user.profile_id] = (acc[user.profile_id] ?? 0) + 1
          return acc
        }, {})
        setCounts(next)
      }
    })
  }

  function openCreate() {
    setError('')
    setPanel({ mode: 'create' })
    setForm({ label: '', name: '', description: '', org_id: lookups.currentUser?.org_id ?? '', clone_from: '' })
  }

  function openEdit(profile: any) {
    setError('')
    setPanel({ mode: 'edit', profile })
    setForm({ label: profile.label ?? '', name: profile.name ?? '', description: profile.description ?? '', org_id: profile.org_id ?? '', clone_from: '' })
  }

  function openClone(profile: any) {
    setError('')
    setPanel({ mode: 'clone', profile })
    setForm({ label: `Copy of ${profile.label}`, name: slugify(`Copy of ${profile.label}`), description: profile.description ?? '', org_id: profile.org_id ?? '', clone_from: profile.id })
  }

  function submit() {
    if (!panel) return
    setError('')
    setSuccess('')
    startTransition(async () => {
      const label = form.label.trim()
      if (!label) {
        setError('Profile name is required.')
        return
      }
      const result = panel.mode === 'edit'
        ? await adminProfiles.update(panel.profile.id, { label, name: form.name || slugify(label), description: form.description || null })
        : form.clone_from
          ? await adminProfiles.clone(form.clone_from, label)
          : await adminProfiles.create({
              org_id: form.org_id || null,
              label,
              name: form.name || slugify(label),
              description: form.description || null,
              is_system: false,
            })

      if (result.error || !result.data) {
        setError(result.error ?? 'Save failed.')
        return
      }

      setPanel(null)
      setSuccess(panel.mode === 'edit' ? 'Profile updated.' : 'Profile created.')
      refresh()
      if (panel.mode !== 'edit') router.push(`/administration/profiles/${result.data.id}`)
    })
  }

  function deleteProfile(profile: any) {
    if (profile.is_system) return
    if (!window.confirm(`Delete profile ${profile.label}?`)) return
    startTransition(async () => {
      const result = await adminProfiles.delete(profile.id)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  return (
    <div className="admin-profiles-page">
      <div className="admin-page-header">
        <div>
          <h1>Profiles</h1>
          <p>Profiles define the baseline permissions users inherit across modules.</p>
        </div>
        <Button onClick={openCreate}>New Profile</Button>
      </div>

      <div className="admin-filter-bar admin-filter-bar--compact">
        <Input label="Search" placeholder="Profile name" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>

      {error && <div className="form-error">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <div className="super-table">
        <table>
          <thead><tr><th>Profile Name</th><th>Type</th><th>Description</th><th>Users Count</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((profile) => (
              <tr key={profile.id}>
                <td><button className="text-link table-link-button" onClick={() => router.push(`/administration/profiles/${profile.id}`)}>{profile.is_system ? 'Lock ' : ''}{profile.label}</button></td>
                <td><Badge variant={profile.is_system ? 'slate' : 'primary'}>{profile.is_system ? 'System' : 'Custom'}</Badge></td>
                <td>{profile.description ?? '-'}</td>
                <td>{counts[profile.id] ?? 0}</td>
                <td><div className="row-actions"><Button size="xs" variant="outline" onClick={() => openEdit(profile)}>Edit</Button><Button size="xs" variant="outline" onClick={() => openClone(profile)}>Clone</Button><Button size="xs" variant="danger" disabled={profile.is_system} onClick={() => deleteProfile(profile)}>Delete</Button></div></td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={5}>No profiles found.</td></tr>}
          </tbody>
        </table>
      </div>

      {panel && (
        <div className="slide-over" role="dialog" aria-modal="true" aria-label="Profile form">
          <button className="slide-over__backdrop" onClick={() => setPanel(null)} aria-label="Close panel" />
          <div className="slide-over__panel">
            <div className="slide-over__header"><h2>{panel.mode === 'edit' ? 'Edit Profile' : panel.mode === 'clone' ? 'Clone Profile' : 'New Profile'}</h2><Button size="sm" variant="ghost" onClick={() => setPanel(null)}>Close</Button></div>
            <div className="slide-over__body">
              <Input label="Profile Name" required value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value, name: slugify(event.target.value) })} />
              <Input label="API Name" value={form.name} onChange={(event) => setForm({ ...form, name: slugify(event.target.value) })} />
              <label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
              {panel.mode === 'create' && (
                <>
                  {isSuperadmin && <label>Organisation<select value={form.org_id} onChange={(event) => setForm({ ...form, org_id: event.target.value })}><option value="">System/global</option>{(lookups.organisations ?? []).map((org: any) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>}
                  <label>Start From<select value={form.clone_from} onChange={(event) => setForm({ ...form, clone_from: event.target.value })}><option value="">Blank profile</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</select></label>
                </>
              )}
            </div>
            <div className="slide-over__footer"><Button variant="outline" onClick={() => setPanel(null)}>Cancel</Button><Button loading={isPending} onClick={submit}>{panel.mode === 'edit' ? 'Save' : 'Create'}</Button></div>
          </div>
        </div>
      )}
    </div>
  )
}
