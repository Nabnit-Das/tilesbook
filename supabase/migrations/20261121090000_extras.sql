-- Supplementary shop workflows use the same membership, tenant lock and retry ledger as billing.
create table public.year_closures (like public.slabs including defaults including constraints,
 primary key(id), foreign key(business_id) references public.businesses(id) on delete cascade, unique(business_id,id));
create table public.slab_events (like public.slabs including defaults including constraints,
 primary key(id), foreign key(business_id) references public.businesses(id) on delete cascade, unique(business_id,id));
alter table public.year_closures enable row level security;
alter table public.slab_events enable row level security;
create policy year_closure_read on public.year_closures for select using(tilebook.my_role(business_id) is not null);
create policy slab_event_read on public.slab_events for select using(tilebook.my_role(business_id) is not null);
revoke all on public.year_closures, public.slab_events from public,anon,authenticated;
insert into tilebook.resource_map values ('yearClosures','year_closures'),('slabEvents','slab_events');
create unique index year_end_per_firm on public.year_closures(business_id,(payload->>'through'));
create unique index statement_identity on public.bank_entries(business_id,(payload->>'bankId'),(payload->>'date'),(payload->>'reference'),(payload->>'amount'),(payload->>'direction')) where payload->>'origin'='statement';
create unique index one_statement_per_payment on public.bank_entries(business_id,(payload->>'paymentId')) where payload->>'origin'='statement' and payload->>'paymentId' is not null;
create table tilebook.verified_restores(business_id uuid primary key, transaction_id bigint not null);
revoke all on tilebook.verified_restores from public,anon,authenticated;

create function tilebook.check_posting_date() returns trigger language plpgsql set search_path='' as $$
declare stop_date date; posted date:=coalesce((new.payload->>'date')::date,(now() at time zone 'Asia/Kolkata')::date);
begin
 -- Later payments can still reduce a closed invoice's balance. Only its original posting date is locked.
 if tg_op='UPDATE' and old.payload->>'date' is not distinct from new.payload->>'date' then return new; end if;
 if exists(select 1 from tilebook.verified_restores where business_id=new.business_id and transaction_id=txid_current()) then return new; end if;
 perform pg_advisory_xact_lock(hashtext(new.business_id::text));
 select max((payload->>'through')::date) into stop_date from public.year_closures where business_id=new.business_id;
 if posted<=stop_date or (tg_op='UPDATE' and (old.payload->>'date')::date<=stop_date) then
  raise exception 'Financial year is closed through %',stop_date;
 end if;
 return new;
end $$;
do $triggers$ declare t text; begin
 foreach t in array array['sale_invoices','estimates','proformas','sale_orders','delivery_challans','credit_notes','purchase_bills','purchase_orders','debit_notes','payments','expenses','cash_adjustments'] loop
 execute format('create trigger fiscal_date_lock before insert or update on public.%I for each row execute function tilebook.check_posting_date()',t);
 end loop;
end $triggers$;

create function tilebook.verify_closed_archive(b uuid, archive_id uuid) returns void language plpgsql set search_path='' as $$
declare snapshot jsonb; period_end date; m record; actual jsonb; archived jsonb;
begin
 select max((payload->>'through')::date) into period_end from public.year_closures where business_id=b;
 if period_end is null then return; end if;
 select data into snapshot from tilebook.archives where id=archive_id and business_id=b;
 if snapshot is null then raise exception 'Backup unavailable'; end if;
 for m in select * from tilebook.resource_map where resource in ('saleInvoices','estimates','proformas','saleOrders','challans','creditNotes','purchaseBills','purchaseOrders','debitNotes','payments','expenses','cashAdjustments','yearClosures') loop
  execute format('select coalesce(jsonb_object_agg(id,payload),''{}'') from public.%I where business_id=$1 and ($3 or coalesce((payload->>''date'')::date,created_at::date)<=$2)',m.table_name)
   into actual using b,period_end,(m.resource='yearClosures');
  select coalesce(jsonb_object_agg(t->>'id',t->'payload'),'{}') into archived from jsonb_array_elements(coalesce(snapshot->m.resource,'[]')) t
   where m.resource='yearClosures' or coalesce((t#>>'{payload,date}')::date,(t->>'created_at')::timestamptz::date)<=period_end;
  if actual<>archived then raise exception 'Backup differs from the closed books through %',period_end; end if;
 end loop;
 insert into tilebook.verified_restores values(b,txid_current());
end $$;

create function tilebook.work_slab(b uuid,k text,p jsonb) returns jsonb language plpgsql set search_path='' as $$
declare slab jsonb:=tilebook.need_row(b,'slabs',p->>'slabId'); state text:=lower(coalesce(slab->>'status','available'));
 order_row jsonb; change jsonb; child jsonb; new_children jsonb:='[]'; shape record; sw numeric; sl numeric; cw numeric; cl numeric;
begin
 if state not in ('available','remnant','reserved') then raise exception 'This slab has already been cut'; end if;
 if k='slabReserve' then
  if state='reserved' then raise exception 'Slab already reserved'; end if;
  order_row:=tilebook.need_row(b,'saleOrders',p->>'orderId');
  if coalesce((order_row->>'received')::bigint,0)-coalesce((order_row->>'advanceApplied')::bigint,0)<=0
   or lower(order_row->>'status') not in ('open','partial') then raise exception 'Choose an open order with an advance held'; end if;
  change:=tilebook.put(b,'slabs',(slab->>'id')::uuid,slab||jsonb_build_object('status','reserved','orderId',order_row->>'id','partyId',order_row->>'partyId','reservedFor',order_row->>'partyId'),true);
 else
  sl:=(slab->>'length')::numeric; sw:=(slab->>'width')::numeric; cl:=(p->>'length')::numeric; cw:=(p->>'width')::numeric;
  if cl is null or cw is null or cl<=0 or cw<=0 or cl>sl or cw>sw or (cl=sl and cw=sw)
   or round(cl,3)<>cl or round(cw,3)<>cw then raise exception 'Cut must fit inside the slab and leave a remnant'; end if;
  -- Cut at a corner. Rectangles split along the length first and conserve the measured area.
  for shape in select * from (values ('C1',cl,cw),('R1',sl-cl,sw),('R2',cl,sw-cw)) as pieces(suffix,l,w) where l>0 and w>0 loop
    child:=(slab-array['id','createdAt','updatedAt','businessId','children','orderId','reservedFor','partyId'])
     ||jsonb_build_object('slabNo',(slab->>'slabNo')||'-'||shape.suffix,'parentId',slab->>'id','parentSlab',slab->>'slabNo','length',shape.l,'width',shape.w,'area',round(shape.l*shape.w,6),'status',case when shape.suffix<>'C1' then 'remnant' when state='reserved' then 'reserved' else 'available' end);
    if shape.suffix='C1' and state='reserved' then child:=child||jsonb_build_object('orderId',slab->>'orderId','partyId',slab->>'partyId','reservedFor',slab->>'reservedFor'); end if;
    child:=tilebook.put(b,'slabs',gen_random_uuid(),child);
    new_children:=new_children||jsonb_build_array(child->>'id');
  end loop;
  change:=tilebook.put(b,'slabs',(slab->>'id')::uuid,slab||jsonb_build_object('status','cut','children',new_children),true);
 end if;
 perform tilebook.put(b,'slabEvents',gen_random_uuid(),jsonb_build_object('slabId',slab->>'id','slabNo',slab->>'slabNo','kind',k,'beforeStatus',state,'status',change->>'status','orderId',change->>'orderId','children',new_children,'createdBy',auth.uid(),'date',(now() at time zone 'Asia/Kolkata')::date));
 return change;
end $$;

create function tilebook.work_statement(b uuid,k text,p jsonb) returns jsonb language plpgsql set search_path='' as $$
declare account jsonb; line jsonb; payment jsonb; normalized jsonb; inserted int:=0; total integer; ref text; d date; amt bigint; affected int;
begin
 if k='matchBankLine' then
  line:=tilebook.need_row(b,'bankEntries',p->>'lineId'); payment:=tilebook.need_row(b,'payments',p->>'paymentId');
  if line->>'origin' is distinct from 'statement' or line->>'paymentId' is not null then raise exception 'Select an unmatched statement line'; end if;
  if payment->>'bankId' is distinct from line->>'bankId' or lower(payment->>'direction') is distinct from line->>'direction'
   or (payment->>'amount')::bigint is distinct from (line->>'amount')::bigint then raise exception 'Bank, direction and amount must match'; end if;
  if exists(select from public.bank_entries where business_id=b and payload->>'paymentId'=payment->>'id') then raise exception 'Payment already matched'; end if;
  return tilebook.put(b,'bankEntries',(line->>'id')::uuid,line||jsonb_build_object('status','matched','paymentId',payment->>'id','matchedBy',auth.uid(),'matchedAt',now()),true);
 end if;
 account:=tilebook.need_row(b,'banks',p->>'bankId');
 if jsonb_typeof(p->'lines') is distinct from 'array' then raise exception 'Statement rows required'; end if;
 total:=jsonb_array_length(p->'lines'); if total not between 1 and 500 then raise exception 'Import 1 to 500 statement rows'; end if;
 for line in select * from jsonb_array_elements(p->'lines') loop
  d:=(line->>'date')::date; amt:=(line->>'amount')::bigint; ref:=trim(line->>'reference');
  if d is null or amt is null or amt<=0 or ref is null or length(ref) not between 1 and 150 or coalesce(line->>'direction','') not in ('in','out') then raise exception 'Invalid statement line'; end if;
  normalized:=jsonb_build_object('bankId',account->>'id','origin','statement','date',d,'reference',ref,'description',left(coalesce(line->>'description',''),250),'amount',amt,'direction',line->>'direction','status','unmatched','createdBy',auth.uid());
  insert into public.bank_entries(business_id,payload) values(b,normalized) on conflict do nothing;
  get diagnostics affected=row_count; inserted:=inserted+affected;
 end loop;
 return jsonb_build_object('id',gen_random_uuid(),'imported',inserted,'duplicates',total-inserted,'bankId',account->>'id');
end $$;

alter function public.tilebook_mutate(uuid,text,text,jsonb,uuid) rename to post_ordinary;
alter function public.post_ordinary(uuid,text,text,jsonb,uuid) set schema tilebook;
revoke all on function tilebook.post_ordinary(uuid,text,text,jsonb,uuid) from public,anon,authenticated;
create function public.tilebook_mutate(p_business_id uuid,p_resource text,p_action text,p_data jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b uuid:=tilebook.default_business(p_business_id); r text:=tilebook.my_role(b); k text:=p_resource;
 extra boolean:=k in ('slabReserve','slabCut','statementImport','matchBankLine','closeFinancialYear');
 prior tilebook.operations; original jsonb:=jsonb_build_array(k,p_action,p_data); result jsonb; prev jsonb; through_date date; previous_end date;
begin
 if k is null or p_action is null then raise exception 'Invalid mutation'; end if;
 if k in ('yearClosures','slabEvents') then raise exception 'Managed ledger is read-only'; end if;
 if not extra and k not in ('slabs','bankEntries','backups') then return tilebook.post_ordinary(b,k,p_action,p_data,p_request_id); end if;
 if p_request_id is null or r is null or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'Invalid mutation'; end if;
 if not extra and not tilebook.can_write(r,k) then raise exception 'Permission denied'; end if;
 if extra and (p_action is distinct from 'create' or (k='closeFinancialYear' and r<>'Owner')
 or (k in ('statementImport','matchBankLine') and r not in ('Owner','Manager'))
 or (k in ('slabReserve','slabCut') and r not in ('Owner','Manager','Godown'))) then raise exception 'Permission denied'; end if;
 perform pg_advisory_xact_lock(hashtext(b::text));
 select * into prior from tilebook.operations where business_id=b and request_id=p_request_id;
 if found then
  if prior.actor<>auth.uid() or prior.input<>original then raise exception 'Request id already in use'; end if;
  if extra and prior.superseded then raise exception 'Reversed by backup restore'; end if;
  if extra then return prior.result; end if;
  return tilebook.post_ordinary(b,k,p_action,p_data,p_request_id);
 end if;
 if not extra then
  if k='backups' and p_action='restore' then
    perform tilebook.verify_closed_archive(b,(p_data->>'id')::uuid);
    result:=tilebook.post_ordinary(b,k,p_action,p_data,p_request_id);
    delete from tilebook.verified_restores where business_id=b and transaction_id=txid_current();
    return result;
  end if;
  if k in ('slabs','bankEntries') and p_action='update' then prev:=tilebook.need_row(b,k,p_data->>'id'); end if;
  if k='slabs' and (lower(coalesce(prev->>'status','available'))<>'available' or lower(coalesce(p_data->>'status','available'))<>'available'
    or coalesce(p_data->>'orderId',p_data->>'reservedFor',p_data->>'parentId',p_data->>'parentSlab','')<>'' or p_data ? 'children' or coalesce(p_data->>'partyId','')<>'') then raise exception 'Change slab reservations and cuts in the workshop'; end if;
  if k='bankEntries' and (prev->>'origin'='statement' or p_data->>'origin'='statement') then raise exception 'Use bank statement reconciliation'; end if;
  if k='bankEntries' and nullif(coalesce(p_data->>'paymentId',prev->>'paymentId'),'') is not null then
    prev:=coalesce(prev,'{}')||p_data;
    result:=tilebook.need_row(b,'payments',prev->>'paymentId');
    if nullif(prev->>'bankId','') is null or result->>'bankId' is distinct from prev->>'bankId' or lower(result->>'direction') is distinct from lower(prev->>'direction')
     or (result->>'amount')::bigint is distinct from (prev->>'amount')::bigint then raise exception 'Bank, direction and amount must match'; end if;
    if exists(select from public.bank_entries where business_id=b and payload->>'paymentId'=result->>'id' and (p_action<>'update' or id::text is distinct from prev->>'id')) then raise exception 'Payment already matched'; end if;
  end if;
  return tilebook.post_ordinary(b,k,p_action,p_data,p_request_id);
 end if;
 if k in ('slabReserve','slabCut') and tilebook.entitlements(b)->>'premium'='false' then raise exception 'Upgrade to Pro to use the slab workshop'; end if;
 perform tilebook.checkpoint_today(b);
 if k in ('slabReserve','slabCut') then
  prev:=tilebook.need_row(b,'slabs',p_data->>'slabId'); result:=tilebook.work_slab(b,k,p_data);
 elsif k in ('statementImport','matchBankLine') then
  if k='matchBankLine' then prev:=tilebook.need_row(b,'bankEntries',p_data->>'lineId'); end if;
  result:=tilebook.work_statement(b,k,p_data);
 else
  through_date:=(p_data->>'through')::date;
  if through_date is null or p_data->>'confirm' is distinct from through_date::text or to_char(through_date,'MM-DD')<>'03-31'
   or through_date>=(now() at time zone 'Asia/Kolkata')::date then raise exception 'Confirm a completed financial year ending on 31 March'; end if;
  select max((payload->>'through')::date) into previous_end from public.year_closures where business_id=b;
  if through_date<=previous_end then raise exception 'This financial year is already closed'; end if;
  result:=tilebook.put(b,'yearClosures',gen_random_uuid(),jsonb_build_object('through',through_date,'previousEnd',previous_end,'date',(now() at time zone 'Asia/Kolkata')::date,'createdBy',auth.uid()));
 end if;
 perform tilebook.put(b,'audit',gen_random_uuid(),jsonb_build_object('actorId',auth.uid(),'resource',k,'recordId',result->>'id','action','create','date',current_date,'before',prev,'after',result));
 result:=jsonb_build_object('row',result);
 insert into tilebook.operations(business_id,request_id,actor,input,result) values(b,p_request_id,auth.uid(),original,result);
 return result;
end $$;
revoke all on function tilebook.check_posting_date(), tilebook.work_slab(uuid,text,jsonb),tilebook.work_statement(uuid,text,jsonb),public.tilebook_mutate(uuid,text,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function tilebook.verify_closed_archive(uuid,uuid) from public,anon,authenticated;
grant execute on function public.tilebook_mutate(uuid,text,text,jsonb,uuid) to authenticated;

