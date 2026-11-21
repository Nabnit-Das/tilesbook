-- Scope comes exclusively from Supabase Auth; clients receive no base-table grants.
create schema if not exists tilebook;
revoke all on schema tilebook from public, anon, authenticated;

create table public.businesses (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(name) between 1 and 200),
 details jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.memberships (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('Owner','Manager','Counter','Godown','Accountant')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(business_id,user_id)
);
create index memberships_by_user on public.memberships(user_id);
create function tilebook.my_role(b uuid) returns text
 language sql stable security definer set search_path='' as
 $$select role from public.memberships where business_id=b and user_id=auth.uid()$$;
create function tilebook.can_read(r text, k text) returns boolean language sql immutable as $$
 select case when r is null then false
 when k in ('audit','backups','users','portalLinks','outbox') then r in ('Owner','Manager')
 when k in ('productCosts','purchaseBills','purchaseOrders','debitNotes','partners','commissions','commissionPayments','loans','bankEntries','staffAdvances','approvals','subscriptions','priceLists') then r in ('Owner','Manager','Accountant')
 else true end
$$;
create function tilebook.can_write(r text,k text) returns boolean language sql immutable as $$
 select case when r is null or r='Accountant' then false
 when k in ('stockMovements','productCosts','audit','commissions','outbox') then false
 when k in ('users','subscriptions','settings','backups','approvals','portalLinks','businesses') then r='Owner'
 when r in ('Owner','Manager') then true
 when r='Godown' then k in ('damage','display','stockCounts','transfers','lots','challans','slabs')
 when r='Counter' then k in ('parties','saleInvoices','estimates','proformas','saleOrders','payments','complaints','followUps')
 else false end
$$;
alter table public.businesses enable row level security;
alter table public.memberships enable row level security;
create policy business_isolation on public.businesses for select using(tilebook.my_role(id) is not null);
create policy membership_isolation on public.memberships for select using(user_id=auth.uid() or tilebook.my_role(business_id)='Owner');
create table tilebook.resource_map(resource text primary key, table_name name not null unique);
insert into tilebook.resource_map values
 ('parties','parties'),
 ('products','products'),
 ('productCosts','product_costs'),
 ('categories','categories'),
 ('services','services'),
 ('lots','lots'),
 ('stockMovements','stock_movements'),
 ('saleInvoices','sale_invoices'),
 ('estimates','estimates'),
 ('proformas','proformas'),
 ('saleOrders','sale_orders'),
 ('challans','delivery_challans'),
 ('creditNotes','credit_notes'),
 ('purchaseBills','purchase_bills'),
 ('purchaseOrders','purchase_orders'),
 ('debitNotes','debit_notes'),
 ('payments','payments'),
 ('banks','bank_accounts'),
 ('cheques','cheques'),
 ('loans','loan_accounts'),
 ('expenses','expenses'),
 ('expenseCategories','expense_categories'),
 ('damage','damage_logs'),
 ('display','display_stock'),
 ('slabs','slabs'),
 ('partners','trade_partner_rules'),
 ('commissions','commissions'),
 ('commissionPayments','commission_payments'),
 ('followUps','follow_ups'),
 ('reminders','reminders'),
 ('offers','offers'),
 ('campaigns','campaigns'),
 ('printTemplates','print_templates'),
 ('subscriptions','subscriptions'),
 ('audit','audit_logs'),
 ('backups','backup_records'),
 ('settings','settings'),
 ('branches','branches'),
 ('stockCounts','stock_counts'),
 ('transfers','stock_transfers'),
 ('users','staff_invitations'),
 ('cashAdjustments','cash_adjustments'),
 ('closings','cash_closings'),
 ('bankEntries','bank_entries'),
 ('attendance','attendance'),
 ('staffAdvances','staff_advances'),
 ('complaints','complaints'),
 ('approvals','approvals'),
 ('priceLists','price_lists'),
 ('portalLinks','portal_links'),
 ('outbox','message_outbox');
-- Separate operational tables share a versioned JSON payload. IDs, tenant keys,
-- lifecycle timestamps and high-use association keys are relational/indexed.
do $migration$
declare m record;
begin
 for m in select * from tilebook.resource_map loop
  execute format('create table public.%I (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, payload jsonb not null check(jsonb_typeof(payload)=''object''), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(business_id,id))',m.table_name);
  execute format('create index on public.%I (business_id, created_at)',m.table_name);
  execute format('alter table public.%I enable row level security',m.table_name);
  execute format('create policy tenant_read on public.%I for select using(tilebook.can_read(tilebook.my_role(business_id),%L))',m.table_name,m.resource);
  execute format('create policy tenant_insert on public.%I for insert with check(tilebook.can_write(tilebook.my_role(business_id),%L))',m.table_name,m.resource);
  execute format('create policy tenant_update on public.%I for update using(tilebook.can_write(tilebook.my_role(business_id),%L)) with check(tilebook.can_write(tilebook.my_role(business_id),%L))',m.table_name,m.resource,m.resource);
  execute format('revoke all on table public.%I from public, anon, authenticated',m.table_name);
 end loop;
end $migration$;
revoke all on public.businesses, public.memberships from public, anon, authenticated;

create unique index on public.lots(business_id,(payload->>'productId'),(payload->>'lotNo'),(payload->>'shade'));
create unique index on public.product_costs(business_id,(payload->>'productId'));
create unique index on public.settings(business_id,(payload->>'key'));
create unique index on public.products(business_id,(payload->>'barcode')) where coalesce(payload->>'barcode','')<>'';
create index on public.stock_movements(business_id,(payload->>'lotId'),(payload->>'branchId'));
create index on public.payments(business_id,(payload->>'documentId'));
create index on public.commissions(business_id,(payload->>'partnerId'));
create table tilebook.operations (
 business_id uuid not null references public.businesses(id) on delete cascade,
 request_id uuid not null,actor uuid not null,input jsonb not null,result jsonb not null,
 primary key(business_id,request_id)
);
create table tilebook.counters(business_id uuid not null references public.businesses(id) on delete cascade,
 resource text not null,sequence bigint not null,primary key(business_id,resource));

create function tilebook.envelope(row_id uuid,b uuid,p jsonb,c timestamptz,u timestamptz)
 returns jsonb language sql immutable as $$
 select p || jsonb_build_object('id',row_id,'businessId',b,'createdAt',c,'updatedAt',u)
$$;
create function tilebook.row_for(b uuid,k text,i uuid) returns jsonb
 language plpgsql stable set search_path='' as $$
declare t name; v jsonb;
begin
 select table_name into strict t from tilebook.resource_map where resource=k;
 execute format('select tilebook.envelope(id,business_id,payload,created_at,updated_at) from public.%I where business_id=$1 and id=$2',t) into v using b,i;
 return v;
end $$;
create function tilebook.need_row(b uuid,k text,i text) returns jsonb language plpgsql stable set search_path='' as $$
declare v jsonb;
begin
 v:=tilebook.row_for(b,k,nullif(i,'')::uuid);
 if v is null then raise exception 'Missing or inaccessible % record',k using errcode='22023'; end if;
 return v;
end $$;
create function tilebook.put(b uuid,k text,i uuid,p jsonb,replace boolean default false) returns jsonb
 language plpgsql set search_path='' as $$
declare t name; v jsonb;
begin
 select table_name into strict t from tilebook.resource_map where resource=k;
 p:=p-array['id','businessId','createdAt','updatedAt'];
 if replace then
 execute format('update public.%I set payload=$3,updated_at=now() where id=$1 and business_id=$2 returning tilebook.envelope(id,business_id,payload,created_at,updated_at)',t) into v using i,b,p;
 if v is null then raise exception 'Record is unavailable'; end if;
 else
 execute format('insert into public.%I(id,business_id,payload) values($1,$2,$3) returning tilebook.envelope(id,business_id,payload,created_at,updated_at)',t) into v using i,b,p;
 end if;
 return v;
end $$;
create function tilebook.stock(b uuid,i text,branch text default null) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('physical',coalesce(sum((payload->>'physical')::numeric),0),'reserved',coalesce(sum((payload->>'reserved')::numeric),0),'display',coalesce(sum((payload->>'display')::numeric),0),'sellable',coalesce(sum((payload->>'physical')::numeric-(payload->>'reserved')::numeric-(payload->>'display')::numeric),0))
 from public.stock_movements where business_id=b and payload->>'lotId'=i and (branch is null or payload->>'branchId'=branch)
$$;
create function tilebook.move_stock(b uuid,l jsonb,location text,doc uuid,reason text,physical numeric,reserved numeric default 0,display numeric default 0) returns void language plpgsql set search_path='' as $$
begin
 perform tilebook.put(b,'stockMovements',gen_random_uuid(),jsonb_build_object('productId',l->>'productId','lotId',l->>'id','lotNo',l->>'lotNo','shade',l->>'shade','branchId',location,'documentId',doc,'kind',reason,'date',current_date,'physical',physical,'reserved',reserved,'display',display));
end $$;
create function tilebook.number_for(b uuid,k text,prefix text) returns text language plpgsql set search_path='' as $$
declare n bigint;
begin
 insert into tilebook.counters values(b,k,1) on conflict(business_id,resource) do update set sequence=tilebook.counters.sequence+1 returning sequence into n;
 return prefix||'-'||n;
end $$;
revoke all on all functions in schema tilebook from public,anon,authenticated;

