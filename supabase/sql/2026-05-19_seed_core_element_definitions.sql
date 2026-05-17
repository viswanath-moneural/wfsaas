-- Seed core Element definitions (Business Unit scoped)
-- Replace these values before running:
--   YOUR_ORG_ID
--   YOUR_BUSINESS_UNIT_ID

insert into public.element_definitions
  (org_id, business_unit_id, element_key, element_name, element_name_plural,
   description, icon, color, table_name, is_core, sort_order)
values
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','customers','Customer','Customers','Customer master data and account info','Users','blue','customers',true,10),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','vendors','Vendor','Vendors','Supplier and vendor master data','Building2','amber','vendors',true,20),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','parties','Party','Parties','Unified stakeholder master record','ContactRound','indigo','parties',true,30),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','contact_persons','Contact','Contacts','People linked to parties','UserRound','slate','contact_persons',true,40),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','leads','Lead','Leads','Unqualified prospects and inquiries','UserPlus','green','leads',true,50),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','opportunities','Opportunity','Opportunities','Qualified sales deals in pipeline','Target','purple','opportunities',true,60),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','interactions','Interaction','Interactions','Calls, meetings, and follow-up logs','MessageSquare','teal','interactions',true,70),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','quotes','Quotation','Quotations','Price quotes sent to customers','FileText','sky','quotes',true,110),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','sales_orders','Sales Order','Sales Orders','Confirmed customer orders','ClipboardList','blue','sales_orders',true,120),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','invoices','Invoice','Invoices','Tax invoices raised to customers','Receipt','green','invoices',true,130),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','dispatch_orders','Dispatch Order','Dispatch Orders','Goods dispatch and delivery records','Truck','orange','dispatch_orders',true,140),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','sales_returns','Sales Return','Sales Returns','Returned goods from customers','RotateCcw','red','sales_returns',true,150),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','customer_payments','Payment','Payments','Incoming payments from customers','Banknote','emerald','customer_payments',true,160),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','purchase_orders','Purchase Order','Purchase Orders','Orders placed with vendors','ShoppingCart','amber','purchase_orders',true,210),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','goods_receipt_notes','Goods Receipt','Goods Receipts','Incoming material receipts from vendors','PackageCheck','lime','goods_receipt_notes',true,220),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','purchase_returns','Purchase Return','Purchase Returns','Materials returned to vendors','PackageX','red','purchase_returns',true,230),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','vendor_payments','Vendor Payment','Vendor Payments','Outgoing payments to vendors','ArrowUpFromLine','orange','vendor_payments',true,240),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','products','Product','Products','Finished goods and product catalog','Box','violet','products',true,310),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','materials','Material','Materials','Raw materials and input inventory','Layers','stone','materials',true,320),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','machines','Machine','Machines','Production machines and equipment','Cog','zinc','machines',true,330),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','operators','Operator','Operators','Machine operators and production staff','HardHat','yellow','operators',true,340),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','production_runs','Production Run','Production Runs','Batch production execution records','Activity','orange','production_runs',true,350),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','work_orders','Work Order','Work Orders','Planned production work assignments','ClipboardCheck','blue','work_orders',true,360),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','quality_checks','Quality Check','Quality Checks','Quality inspection and results','ShieldCheck','green','quality_checks',true,370),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','bill_of_materials','Bill of Materials','Bills of Materials','Material requirements per product','ListTree','amber','bill_of_materials',true,380),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','warehouses','Warehouse','Warehouses','Warehouse and storage location master','Warehouse','cyan','warehouses',true,410),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','stock_movements','Stock Movement','Stock Movements','Inventory in/out movement records','ArrowLeftRight','blue','stock_movements',true,420),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','stock_adjustments','Stock Adjustment','Stock Adjustments','Manual inventory corrections','SlidersHorizontal','red','stock_adjustments',true,430),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','expenses','Expense','Expenses','Business expense records','CreditCard','rose','expenses',true,510),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','pricing','Price List','Price Lists','Product pricing and rate cards','Tag','green','price_lists',true,520),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','employees','Employee','Employees','Employee records and HR data','UserRound','teal','employees',true,610),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','attendance','Attendance','Attendance','Daily attendance and shift records','CalendarCheck','green','attendance',true,620),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','payroll_runs','Payroll Run','Payroll Runs','Monthly payroll processing records','Wallet','amber','payroll_runs',true,630),
('YOUR_ORG_ID','YOUR_BUSINESS_UNIT_ID','salary_structure','Salary Structure','Salary Structures','Pay components and salary bands','LayoutList','blue','salary_structure',true,640)
on conflict (org_id, business_unit_id, element_key) do update
set
  element_name = excluded.element_name,
  element_name_plural = excluded.element_name_plural,
  description = excluded.description,
  icon = excluded.icon,
  color = excluded.color,
  table_name = excluded.table_name,
  is_core = excluded.is_core,
  sort_order = excluded.sort_order,
  is_active = true,
  last_modified_at = now();
