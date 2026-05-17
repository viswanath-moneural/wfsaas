-- Seed core Data Bonds (Relationships) - Business Unit scoped
-- Replace:
--   YOUR_ORG_ID
--   YOUR_BUSINESS_UNIT_ID

insert into public.data_bond_definitions
  (org_id, business_unit_id, bond_key, bond_name, bond_type,
   from_element_key, from_field_key,
   to_element_key, to_field_key,
   display_field_key, related_list_label,
   on_delete, is_core)
values
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','customers_party','Customer -> Party','lookup','customers','party_id','parties','id','party_name','Customers','restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','customers_pricelist','Customer -> Price List','lookup','customers','price_list_id','pricing','id','list_name',null,'restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','sales_orders_customer','Sales Order -> Customer','lookup','sales_orders','customer_id','customers','id','customer_name','Sales Orders','restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','invoices_sales_order','Invoice -> Sales Order','lookup','invoices','so_id','sales_orders','id','so_code','Invoices','restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','invoices_customer','Invoice -> Customer','lookup','invoices','customer_id','customers','id','customer_name','Invoices','restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','invoices_dispatch','Invoice -> Dispatch Order','lookup','invoices','do_id','dispatch_orders','id','do_code',null,'restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','dispatch_sales_order','Dispatch -> Sales Order','lookup','dispatch_orders','so_id','sales_orders','id','so_code','Dispatch Orders','restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','dispatch_customer','Dispatch -> Customer','lookup','dispatch_orders','customer_id','customers','id','customer_name',null,'restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','quotes_customer','Quote -> Customer','lookup','quotes','customer_id','customers','id','customer_name','Quotations','restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','payments_customer','Payment -> Customer','lookup','customer_payments','customer_id','customers','id','customer_name','Payments','restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','payments_invoice','Payment -> Invoice','lookup','customer_payments','invoice_id','invoices','id','invoice_no',null,'restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','purchase_orders_vendor','PO -> Vendor','lookup','purchase_orders','vendor_id','vendors','id','vendor_name','Purchase Orders','restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','grn_purchase_order','GRN -> Purchase Order','lookup','goods_receipt_notes','po_id','purchase_orders','id','po_code','Receipts','restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','grn_vendor','GRN -> Vendor','lookup','goods_receipt_notes','vendor_id','vendors','id','vendor_name',null,'restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','production_runs_product','Production -> Product','lookup','production_runs','product_id','products','id','product_name','Production Runs','restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','production_runs_machine','Production -> Machine','lookup','production_runs','machine_id','machines','id','machine_name','Production Runs','restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','production_runs_operator','Production -> Operator','lookup','production_runs','operator_id','operators','id','operator_name','Production Runs','restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','work_orders_product','Work Order -> Product','lookup','work_orders','product_id','products','id','product_name','Work Orders','restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','work_orders_machine','Work Order -> Machine','lookup','work_orders','machine_id','machines','id','machine_name',null,'restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','bom_product','BOM -> Product','master_detail','bill_of_materials','product_id','products','id','product_name','Bill of Materials','cascade',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','bom_material','BOM -> Material','lookup','bill_of_materials','material_id','materials','id','material_name','Used In','restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','employees_operator','Employee -> Operator','lookup','employees','operator_id','operators','id','operator_name',null,'restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','attendance_operator','Attendance -> Operator','lookup','attendance','operator_id','operators','id','operator_name','Attendance','restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','payroll_operator','Payroll -> Operator','lookup','payroll_runs','operator_id','operators','id','operator_name','Payroll Runs','restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','leads_source','Lead -> Lead Source','lookup','leads','lead_source_id','lead_sources','id','source_name',null,'restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','opportunities_lead','Opportunity -> Lead','lookup','opportunities','lead_id','leads','id','name','Opportunities','restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','opportunities_customer','Opportunity -> Customer','lookup','opportunities','customer_id','customers','id','customer_name','Opportunities','restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','quotes_opportunity','Quote -> Opportunity','lookup','quotes','opportunity_id','opportunities','id','title','Quotations','restrict',true),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','parties_parent','Party -> Parent Party','lookup','parties','parent_party_id','parties','id','party_name','Child Parties','restrict',true)
on conflict (org_id, business_unit_id, bond_key) do update
set
  bond_name = excluded.bond_name,
  bond_type = excluded.bond_type,
  from_element_key = excluded.from_element_key,
  from_field_key = excluded.from_field_key,
  to_element_key = excluded.to_element_key,
  to_field_key = excluded.to_field_key,
  display_field_key = excluded.display_field_key,
  related_list_label = excluded.related_list_label,
  on_delete = excluded.on_delete,
  is_core = excluded.is_core,
  last_modified_at = now();
