-- Two-tier module manager foundation (Industry Clouds + Functional Apps)

create table if not exists public.cloud_definitions (
  id uuid primary key default gen_random_uuid(),
  cloud_key text not null unique,
  cloud_name text not null,
  description text,
  icon text,
  color text,
  is_active boolean not null default true,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.app_definitions (
  id uuid primary key default gen_random_uuid(),
  app_key text not null unique,
  app_name text not null,
  description text,
  icon text,
  color text,
  is_active boolean not null default true,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.module_definitions (
  id uuid primary key default gen_random_uuid(),
  module_key text not null unique,
  module_name text not null,
  description text,
  icon text,
  cloud_keys text[] default '{}',
  app_keys text[] default '{}',
  is_core boolean not null default false,
  has_config boolean not null default false,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.org_cloud_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  cloud_key text not null references public.cloud_definitions(cloud_key) on delete cascade,
  is_enabled boolean not null default true,
  enabled_at timestamptz default now(),
  config jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique(org_id, cloud_key)
);

create table if not exists public.org_app_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  app_key text not null references public.app_definitions(app_key) on delete cascade,
  is_enabled boolean not null default true,
  enabled_at timestamptz default now(),
  config jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique(org_id, app_key)
);

alter table public.org_modules add column if not exists cloud_key text;
alter table public.org_modules add column if not exists app_key text;

create index if not exists idx_org_cloud_subscriptions_org on public.org_cloud_subscriptions(org_id, cloud_key);
create index if not exists idx_org_app_subscriptions_org on public.org_app_subscriptions(org_id, app_key);
create index if not exists idx_module_definitions_cloud_keys on public.module_definitions using gin (cloud_keys);
create index if not exists idx_module_definitions_app_keys on public.module_definitions using gin (app_keys);
create index if not exists idx_org_modules_org_module on public.org_modules(org_id, module_key);

insert into public.cloud_definitions (cloud_key, cloud_name, description, icon, color, sort_order)
values
('manufacturing', 'Manufacturing Cloud', 'End-to-end production, machines, operators, quality control', 'Factory', 'orange', 1),
('health', 'Health Cloud', 'Patient management, appointments, clinical workflows', 'HeartPulse', 'red', 2),
('retail', 'Retail Cloud', 'POS, inventory, store management, customer loyalty', 'ShoppingBag', 'pink', 3),
('distribution', 'Distribution Cloud', 'Logistics, warehousing, fleet, delivery management', 'Truck', 'yellow', 4),
('construction', 'Construction Cloud', 'Projects, contractors, materials, site management', 'HardHat', 'amber', 5),
('education', 'Education Cloud', 'Students, courses, fees, attendance tracking', 'GraduationCap', 'cyan', 6),
('hospitality', 'Hospitality Cloud', 'Bookings, rooms, food & beverage, housekeeping', 'Hotel', 'teal', 7),
('agri', 'Agriculture Cloud', 'Farm management, crops, livestock, harvest tracking', 'Leaf', 'green', 8)
on conflict (cloud_key) do update
set cloud_name = excluded.cloud_name,
    description = excluded.description,
    icon = excluded.icon,
    color = excluded.color,
    sort_order = excluded.sort_order;

insert into public.app_definitions (app_key, app_name, description, icon, color, sort_order)
values
('sales', 'Sales', 'Leads, opportunities, quotes, orders, invoices', 'TrendingUp', 'blue', 1),
('service', 'Service', 'Support tickets, SLAs, field service, customer portal', 'Headphones', 'purple', 2),
('marketing', 'Marketing', 'Campaigns, email, WhatsApp, lead capture, analytics', 'Megaphone', 'rose', 3),
('finance', 'Finance', 'Payments, expenses, billing, financial reports', 'BadgeDollarSign', 'green', 4),
('operations', 'Operations', 'Production, machines, work orders, quality checks', 'Settings2', 'orange', 5),
('purchasing', 'Purchasing', 'Vendors, purchase orders, GRN, returns', 'ShoppingCart', 'amber', 6),
('inventory', 'Inventory', 'Warehouses, stock movements, adjustments, alerts', 'Package', 'yellow', 7),
('hr', 'HR & Payroll', 'Employees, attendance, payroll, salary structure', 'Users', 'teal', 8),
('crm', 'CRM', 'Parties, contacts, interactions, relationship history', 'ContactRound', 'indigo', 9),
('analytics', 'Analytics', 'Reports, dashboards, exports, scheduled reports', 'BarChart3', 'cyan', 10),
('platform', 'Platform', 'WhatsApp, API keys, custom fields, integrations', 'Puzzle', 'slate', 11)
on conflict (app_key) do update
set app_name = excluded.app_name,
    description = excluded.description,
    icon = excluded.icon,
    color = excluded.color,
    sort_order = excluded.sort_order;

insert into public.module_definitions (
  module_key, module_name, description, icon, cloud_keys, app_keys, is_core, has_config
)
values
('customers', 'Customers', 'Manage customer master data', 'Users', '{"manufacturing","retail","distribution","construction"}', '{"sales","crm"}', false, false),
('leads', 'Leads', 'Track and qualify sales leads', 'UserPlus', '{"manufacturing","retail","health"}', '{"sales","crm","marketing"}', false, false),
('opportunities', 'Opportunities', 'Manage sales pipeline and deals', 'Target', '{"manufacturing","retail","health","construction"}', '{"sales","crm"}', false, false),
('quotes', 'Quotations', 'Create and send price quotations', 'FileText', '{"manufacturing","retail","distribution"}', '{"sales"}', false, false),
('sales_orders', 'Sales Orders', 'Process customer orders', 'ClipboardList', '{"manufacturing","retail","distribution"}', '{"sales"}', false, false),
('invoices', 'Invoices', 'Generate and manage invoices', 'Receipt', '{"manufacturing","retail","distribution","health"}', '{"sales","finance"}', false, false),
('dispatch_orders', 'Dispatch Orders', 'Manage goods dispatch and delivery', 'Truck', '{"manufacturing","distribution"}', '{"sales","operations"}', false, false),
('sales_returns', 'Sales Returns', 'Handle returned goods from customers', 'RotateCcw', '{"manufacturing","retail"}', '{"sales"}', false, false),
('vendors', 'Vendors', 'Manage vendor/supplier master data', 'Building2', '{"manufacturing","retail","distribution","construction"}', '{"purchasing","crm"}', false, false),
('purchase_orders', 'Purchase Orders', 'Create and track purchase orders', 'ShoppingCart', '{"manufacturing","retail","distribution"}', '{"purchasing"}', false, false),
('goods_receipt', 'Goods Receipt', 'Receive and inspect incoming goods', 'PackageCheck', '{"manufacturing","distribution"}', '{"purchasing","inventory"}', false, false),
('purchase_returns', 'Purchase Returns', 'Return goods to vendors', 'PackageX', '{"manufacturing","retail"}', '{"purchasing"}', false, false),
('products', 'Products', 'Manage product catalog and variants', 'Box', '{"manufacturing","retail","distribution"}', '{"operations","sales"}', false, false),
('materials', 'Raw Materials', 'Track raw material inventory', 'Layers', '{"manufacturing","construction","agri"}', '{"operations","inventory"}', false, false),
('machines', 'Machines', 'Manage production machines and equipment', 'Cog', '{"manufacturing","construction"}', '{"operations"}', false, false),
('operators', 'Operators', 'Manage machine operators and shifts', 'HardHat', '{"manufacturing","construction"}', '{"operations","hr"}', false, false),
('production_runs', 'Production Runs', 'Track and log production batch runs', 'Activity', '{"manufacturing"}', '{"operations"}', false, false),
('work_orders', 'Work Orders', 'Create and assign work orders', 'ClipboardCheck', '{"manufacturing","construction"}', '{"operations"}', false, false),
('quality_checks', 'Quality Control', 'Run quality inspections and record results', 'ShieldCheck', '{"manufacturing","health"}', '{"operations"}', false, false),
('bill_of_materials', 'Bill of Materials', 'Define materials required per product', 'ListTree', '{"manufacturing"}', '{"operations"}', false, false),
('warehouses', 'Warehouses', 'Manage warehouse locations and bins', 'Warehouse', '{"manufacturing","retail","distribution"}', '{"inventory"}', false, false),
('stock_movements', 'Stock Movements', 'Track all inventory in/out movements', 'ArrowLeftRight', '{"manufacturing","retail","distribution"}', '{"inventory"}', false, false),
('stock_adjustments', 'Stock Adjustments', 'Make manual stock corrections', 'SlidersHorizontal', '{"manufacturing","retail","distribution"}', '{"inventory"}', false, false),
('expenses', 'Expenses', 'Record and categorize business expenses', 'CreditCard', '{"manufacturing","retail","health","construction"}', '{"finance"}', false, false),
('customer_payments', 'Customer Payments', 'Record incoming customer payments', 'Banknote', '{"manufacturing","retail","health"}', '{"finance","sales"}', false, false),
('vendor_payments', 'Vendor Payments', 'Record outgoing vendor payments', 'ArrowUpFromLine', '{"manufacturing","retail","distribution"}', '{"finance","purchasing"}', false, false),
('pricing', 'Pricing', 'Manage product price lists and rates', 'Tag', '{"manufacturing","retail","distribution"}', '{"finance","sales"}', false, false),
('employees', 'Employees', 'Manage employee records and documents', 'UserRound', '{"manufacturing","health","construction","retail"}', '{"hr"}', false, false),
('attendance', 'Attendance', 'Track daily attendance and shifts', 'CalendarCheck', '{"manufacturing","construction","health"}', '{"hr"}', false, false),
('payroll', 'Payroll', 'Run monthly payroll and salary disbursement', 'Wallet', '{"manufacturing","health","construction"}', '{"hr"}', false, false),
('salary_structure', 'Salary Structure', 'Define pay components and salary bands', 'LayoutList', '{"manufacturing","health","construction"}', '{"hr"}', false, false),
('parties', 'Parties', 'Unified party master for all stakeholders', 'ContactRound', '{"manufacturing","retail","distribution","health"}', '{"crm","sales"}', false, false),
('interactions', 'Interactions', 'Log calls, meetings, and follow-ups', 'MessageSquare', '{"manufacturing","retail","health"}', '{"crm","sales"}', false, false),
('whatsapp', 'WhatsApp', 'WhatsApp messaging and automation', 'MessageCircle', '{"manufacturing","retail","health","distribution"}', '{"platform","marketing"}', false, true),
('reports', 'Reports', 'Custom reports and scheduled exports', 'BarChart2', '{"manufacturing","retail","health","distribution"}', '{"analytics","platform"}', false, false),
('api_keys', 'API Keys', 'Manage API access keys and permissions', 'Key', '{"manufacturing","retail","health"}', '{"platform"}', true, false),
('custom_fields', 'Custom Fields', 'Add custom data fields to any module', 'PencilRuler', '{"manufacturing","retail","health","distribution"}', '{"platform"}', true, false),
('users', 'Users', 'Manage platform users and invitations', 'Users2', '{"manufacturing","retail","health","distribution"}', '{"platform"}', true, false),
('roles', 'Roles', 'Manage roles and permissions', 'ShieldCheck', '{"manufacturing","retail","health","distribution"}', '{"platform"}', true, false)
on conflict (module_key) do update
set module_name = excluded.module_name,
    description = excluded.description,
    icon = excluded.icon,
    cloud_keys = excluded.cloud_keys,
    app_keys = excluded.app_keys,
    is_core = excluded.is_core,
    has_config = excluded.has_config;

alter table public.cloud_definitions enable row level security;
alter table public.app_definitions enable row level security;
alter table public.module_definitions enable row level security;
alter table public.org_cloud_subscriptions enable row level security;
alter table public.org_app_subscriptions enable row level security;

drop policy if exists cloud_definitions_read on public.cloud_definitions;
create policy cloud_definitions_read on public.cloud_definitions
for select using (true);

drop policy if exists app_definitions_read on public.app_definitions;
create policy app_definitions_read on public.app_definitions
for select using (true);

drop policy if exists module_definitions_read on public.module_definitions;
create policy module_definitions_read on public.module_definitions
for select using (true);

drop policy if exists org_cloud_subscriptions_isolation on public.org_cloud_subscriptions;
create policy org_cloud_subscriptions_isolation on public.org_cloud_subscriptions
for all
using (public.is_superadmin(auth.uid()) or org_id = public.current_org_id())
with check (public.is_superadmin(auth.uid()) or org_id = public.current_org_id());

drop policy if exists org_app_subscriptions_isolation on public.org_app_subscriptions;
create policy org_app_subscriptions_isolation on public.org_app_subscriptions
for all
using (public.is_superadmin(auth.uid()) or org_id = public.current_org_id())
with check (public.is_superadmin(auth.uid()) or org_id = public.current_org_id());
