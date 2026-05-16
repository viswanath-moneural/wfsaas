const sectionTitles: Record<string, { title: string; description: string }> = {
  users: {
    title: 'Users',
    description: 'Create and manage login users, factory access, and account status.',
  },
  profiles: {
    title: 'Profiles',
    description: 'Define baseline object permissions that users inherit.',
  },
  roles: {
    title: 'Roles',
    description: 'Manage role hierarchy and organisation access levels.',
  },
  'permission-sets': {
    title: 'Permission Sets',
    description: 'Assign additive permissions without changing a user profile.',
  },
  organisation: {
    title: 'Organisation',
    description: 'Manage company identity, plan, fiscal settings, and localisation.',
  },
  factories: {
    title: 'Factories / Business Units',
    description: 'Manage factories, branches, and business-unit access.',
  },
  'number-series': {
    title: 'Number Series',
    description: 'Configure auto-numbering for operational documents.',
  },
  'audit-log': {
    title: 'Audit Log',
    description: 'Review administrative changes and before/after values.',
  },
}

export default async function AdministrationSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  const content = sectionTitles[section] ?? {
    title: 'Administration',
    description: 'Administration section is ready for implementation.',
  }

  return (
    <section className="admin-placeholder">
      <span>Setup</span>
      <h1>{content.title}</h1>
      <p>{content.description}</p>
      <div>
        This page is connected to the Administration shell. The server actions layer is ready for this section's CRUD UI.
      </div>
    </section>
  )
}
