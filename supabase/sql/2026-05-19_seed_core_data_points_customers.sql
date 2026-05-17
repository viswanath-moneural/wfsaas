-- Seed core Data Points for customers element (Business Unit scoped)
-- Replace:
--   YOUR_ORG_ID
--   YOUR_BUSINESS_UNIT_ID

insert into public.data_point_definitions
  (org_id, business_unit_id, element_key, field_key, field_label, field_type, is_core, is_required, is_system, is_searchable, sort_order)
values
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','customers','id','ID','text',true,true,true,false,0),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','customers','business_unit_id','Business Unit','lookup',true,true,true,false,0),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','customers','created_at','Created At','datetime',true,false,true,false,0),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','customers','created_by','Created By','lookup',true,false,true,false,0),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','customers','last_modified_at','Last Modified At','datetime',true,false,true,false,0),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','customers','last_modified_by','Last Modified By','lookup',true,false,true,false,0),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','customers','customer_code','Customer Code','autonumber',true,true,false,true,10),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','customers','customer_name','Customer Name','text',true,true,false,true,20),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','customers','company_name','Company Name','text',true,false,false,true,30),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','customers','mobile','Mobile','phone',true,true,false,true,40),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','customers','gst_number','GST Number','text',true,false,false,true,50),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','customers','address','Address','long_text',true,false,false,false,60),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','customers','city','City','text',true,false,false,true,70),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','customers','state','State','text',true,false,false,true,80),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','customers','credit_limit','Credit Limit','currency',true,false,false,false,90),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','customers','payment_terms','Payment Terms','picklist',true,false,false,false,100),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','customers','price_list_id','Price List','lookup',true,false,false,false,110),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','customers','is_active','Active','boolean',true,true,false,false,120)
on conflict (org_id, business_unit_id, element_key, field_key) do update
set
  field_label = excluded.field_label,
  field_type = excluded.field_type,
  is_core = excluded.is_core,
  is_required = excluded.is_required,
  is_system = excluded.is_system,
  is_searchable = excluded.is_searchable,
  sort_order = excluded.sort_order,
  is_active = true,
  last_modified_at = now();

update public.data_point_definitions
set options = '[
  {"label": "Immediate", "value": "immediate"},
  {"label": "Net 15",    "value": "net15"},
  {"label": "Net 30",    "value": "net30"},
  {"label": "Net 45",    "value": "net45"},
  {"label": "Net 60",    "value": "net60"}
]'::jsonb
where org_id = 'YOUR_ORG_ID'
  and business_unit_id = 'YOUR_BUSINESS_UNIT_ID'
  and element_key = 'customers'
  and field_key = 'payment_terms';

update public.data_point_definitions
set lookup_element_key = 'pricing',
    lookup_display_field = 'list_name'
where org_id = 'YOUR_ORG_ID'
  and business_unit_id = 'YOUR_BUSINESS_UNIT_ID'
  and element_key = 'customers'
  and field_key = 'price_list_id';
