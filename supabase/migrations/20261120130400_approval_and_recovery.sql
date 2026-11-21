-- Operations older than a restored checkpoint keep their idempotency receipts.
alter table tilebook.operations add column superseded boolean not null default false;
alter table tilebook.archives add column known_requests uuid[] not null default '{}';
create function tilebook.archive_requests() returns trigger language plpgsql set search_path='' as $$
begin
 select coalesce(array_agg(request_id),'{}') into new.known_requests from tilebook.operations where business_id=new.business_id and not superseded;
 return new;
end $$;
create trigger freeze_request_ids before insert on tilebook.archives for each row execute function tilebook.archive_requests();
alter function public.tilebook_mutate(uuid,text,text,jsonb,uuid) set schema tilebook;
revoke all on function tilebook.tilebook_mutate(uuid,text,text,jsonb,uuid) from public,anon,authenticated;
create function public.tilebook_mutate(p_business_id uuid,p_resource text,p_action text,p_data jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b uuid:=tilebook.default_business(p_business_id); r text:=tilebook.my_role(b); saved tilebook.operations;
 limit_percent numeric; gross numeric; discount numeric; result jsonb; approval jsonb; posted jsonb; subject jsonb; original jsonb:=jsonb_build_array(p_resource,p_action,p_data);
 prior_keys uuid[]; can_view_cost boolean:=r in ('Owner','Manager','Accountant'); claim_qty numeric;
begin
 if p_resource is null or p_action is null or p_request_id is null or not tilebook.can_write(r,p_resource) then raise exception 'Role cannot change %',p_resource using errcode='42501'; end if;
 if p_action='restore' and p_resource<>'backups' then raise exception 'Only backups can be restored'; end if;
 perform pg_advisory_xact_lock(hashtext(b::text));
 select * into saved from tilebook.operations where business_id=b and request_id=p_request_id;
 if found then
  if saved.actor<>auth.uid() or saved.input<>original then raise exception 'Request id already in use'; end if;
  if saved.superseded then raise exception 'A backup restore reversed this entry. Verify the ledger before re-entering it'; end if;
  return case when can_view_cost then saved.result else jsonb_set(saved.result,'{row}',(saved.result->'row')-array['loss','cost','profit','purchasePrice','landedCost']) end;
 end if;
 if p_resource='approvals' then
  if r<>'Owner' or p_action<>'update' or coalesce(lower(p_data->>'status'),'') not in ('approved','rejected') then raise exception 'Only the owner can decide a pending approval'; end if;
  approval:=tilebook.need_row(b,'approvals',p_data->>'id');
  if approval->>'status'<>'Pending' then raise exception 'This request has already been decided'; end if;
  if lower(p_data->>'status')='approved' then
   posted:=tilebook.tilebook_mutate(b,'saleInvoices','create',approval->'draft',gen_random_uuid());
   p_data:=jsonb_build_object('id',approval->>'id','status','Approved','documentId',posted#>>'{row,id}','documentNumber',posted#>>'{row,number}');
  else
   p_data:=jsonb_build_object('id',approval->>'id','status','Rejected');
  end if;
  p_data:=p_data||jsonb_build_object('pendingApproval',false,'decidedBy',auth.uid(),'decidedAt',now());
 elsif p_resource='saleInvoices' and p_action='create' and r<>'Owner' then
  select nullif(payload#>>'{value,discountLimit}','')::numeric into limit_percent from public.settings where business_id=b and payload->>'key'='preferences';
  if limit_percent is not null and jsonb_typeof(p_data->'lines')='array' then
   select coalesce(sum(round((l->>'qty')::numeric*(l->>'rate')::numeric)),0),coalesce(sum(coalesce((l->>'discount')::numeric,0)),0)+coalesce((p_data->>'billDiscount')::numeric,0)
   into gross,discount from jsonb_array_elements(p_data->'lines') l;
   if gross>0 and discount*100>limit_percent*gross then
    perform tilebook.need_row(b,'parties',p_data->>'partyId');
    approval:=tilebook.put(b,'approvals',gen_random_uuid(),jsonb_build_object('number',tilebook.number_for(b,'approvals','REQ'),'status','Pending','pendingApproval',true,'partyId',p_data->>'partyId','requestedBy',auth.uid(),'date',current_date,'discount',discount,'gross',gross,'draft',p_data));
    result:=jsonb_build_object('row',approval);
    insert into tilebook.operations(business_id,request_id,actor,input,result) values(b,p_request_id,auth.uid(),original,result);
    return result;
   end if;
  end if;
 end if;
 if p_resource='backups' and p_action='restore' then
  select known_requests into prior_keys from tilebook.archives where business_id=b and id=(p_data->>'id')::uuid;
 end if;
 if p_resource='debitNotes' and nullif(p_data->>'damageId','') is not null then
  subject:=tilebook.need_row(b,'damage',p_data->>'damageId');
  if exists(select from public.debit_notes where business_id=b and payload->>'damageId'=subject->>'id') then raise exception 'This damage has already been claimed'; end if;
  if exists(select from jsonb_array_elements(p_data->'lines') ln where ln->>'lotId' is distinct from subject->>'lotId') then raise exception 'Claim must match the damaged lot'; end if;
  if exists(select from jsonb_array_elements(p_data->'lines') ln join public.products prod on prod.id=(ln->>'productId')::uuid and prod.business_id=b where lower(coalesce(ln->>'unit',prod.payload->>'baseUnit'))<>lower(prod.payload->>'baseUnit')) then raise exception 'Use the damaged product base unit for a claim'; end if;
  select sum((ln->>'qty')::numeric) into claim_qty from jsonb_array_elements(p_data->'lines') ln;
  if claim_qty is null or claim_qty>(subject->>'qty')::numeric then raise exception 'Claim exceeds damaged quantity'; end if;
 end if;
 result:=tilebook.tilebook_mutate(b,p_resource,p_action,p_data,p_request_id);
 update tilebook.operations set input=original where business_id=b and request_id=p_request_id;
 if prior_keys is not null then
  update tilebook.operations set superseded=not(request_id=any(prior_keys)) where business_id=b and request_id<>p_request_id
  and input->>0 not in ('backups','audit','users','portalLinks','outbox','subscriptions');
 end if;
 return result;
end $$;
revoke all on function tilebook.archive_requests(),public.tilebook_mutate(uuid,text,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.tilebook_mutate(uuid,text,text,jsonb,uuid) to authenticated;

