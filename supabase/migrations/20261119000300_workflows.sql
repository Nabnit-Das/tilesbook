create table tilebook.archives(
 id uuid primary key,business_id uuid not null references public.businesses(id) on delete cascade,
 saved_at timestamptz not null default now(),data jsonb not null
);
create function tilebook.default_business(requested uuid) returns uuid language plpgsql stable set search_path='' as $$
declare b uuid:=requested;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if b is null then select business_id into b from public.memberships where user_id=auth.uid() order by created_at,business_id limit 1; end if;
 if tilebook.my_role(b) is null then raise exception 'Business access denied' using errcode='42501'; end if;
 return b;
end $$;
-- Only a verified Supabase phone may redeem a matching invitation. A user cannot choose the role.
create function public.tilebook_accept_invites() returns void language plpgsql security definer set search_path='' as $$
declare ph text;
begin
 select regexp_replace(phone,'[^0-9]','','g') into ph from auth.users where id=auth.uid() and phone_confirmed_at is not null;
 if ph is null or ph='' then return; end if;
 insert into public.memberships(business_id,user_id,role)
 select business_id,auth.uid(),payload->>'role' from public.staff_invitations
 where regexp_replace(payload->>'phone','[^0-9]','','g')=ph and payload->>'status'='Invited'
 on conflict(business_id,user_id) do nothing;
 update public.staff_invitations set payload=payload||jsonb_build_object('status','Active','userId',auth.uid()),updated_at=now()
 where regexp_replace(payload->>'phone','[^0-9]','','g')=ph and payload->>'status'='Invited';
end $$;
create function public.tilebook_snapshot(p_business_id uuid default null) returns jsonb
 language plpgsql stable security definer set search_path='' as $$
declare b uuid:=tilebook.default_business(p_business_id); r text:=tilebook.my_role(b);
 m record; entries jsonb; data jsonb:='{}'; companies jsonb; company jsonb; expr text;
begin
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'role',mm.role) order by s.name),'[]') into companies
 from public.businesses s join public.memberships mm on mm.business_id=s.id where mm.user_id=auth.uid();
 select details||jsonb_build_object('id',id,'name',name) into company from public.businesses where id=b;
 for m in select * from tilebook.resource_map order by resource loop
  entries:='[]';
  if tilebook.can_read(r,m.resource) and m.resource<>'productCosts' then
   expr:='t.payload';
  if m.resource='lots' then expr:='(t.payload || tilebook.stock(t.business_id,t.id::text))';
   elsif m.resource='banks' then expr:='(t.payload || jsonb_build_object(''balance'',coalesce((t.payload->>''openingBalance'')::bigint,0)+coalesce((select sum((p.payload->>''amount'')::bigint * case p.payload->>''direction'' when ''out'' then -1 else 1 end) from public.payments p where p.business_id=t.business_id and p.payload->>''bankId''=t.id::text),0),''accountNumber'',coalesce(t.payload->>''accountNumber'',t.payload->>''accountNo''),''upi'',coalesce(t.payload->>''upi'',t.payload->>''upiId'')))';
   elsif m.resource='stockMovements' then expr:='(t.payload || jsonb_build_object(''reason'',t.payload->>''kind'',''qty'',(t.payload->>''physical'')::numeric))';
   elsif m.resource='audit' then expr:='(t.payload || jsonb_build_object(''userId'',t.payload->>''actorId''))';
   elsif m.resource='products' and tilebook.can_read(r,'productCosts') then expr:='(t.payload || coalesce((select c.payload-''productId'' from public.product_costs c where c.business_id=t.business_id and c.payload->>''productId''=t.id::text),''{}''))';
   elsif r in ('Counter','Godown') then expr:='(t.payload - array[''purchasePrice'',''cost'',''profit'',''loss'',''landedCost'',''openingPayable''])';
   end if;
   execute format('select coalesce(jsonb_agg(tilebook.envelope(t.id,t.business_id,%s,t.created_at,t.updated_at) order by t.created_at desc,t.id),''[]'') from public.%I t where t.business_id=$1',expr,m.table_name) into entries using b;
  end if;
  data:=data||jsonb_build_object(m.resource,entries);
 end loop;
 return jsonb_build_object('role',r,'userId',auth.uid(),'business',company,'businesses',companies,'records',data);
end $$;

create function tilebook.post_payment(b uuid,i uuid,p jsonb) returns jsonb language plpgsql set search_path='' as $$
declare doc jsonb; party jsonb; kind text; amt bigint:=(p->>'amount')::bigint; direction text:=lower(p->>'direction');
begin
 if amt is null or amt<=0 or direction is null or direction not in ('in','out') then raise exception 'Enter a positive payment and direction'; end if;
 party:=tilebook.need_row(b,'parties',p->>'partyId');
 if nullif(p->>'bankId','') is not null then perform tilebook.need_row(b,'banks',p->>'bankId'); end if;
 if nullif(p->>'documentId','') is not null then
  kind:=case when direction='out' then 'purchaseBills' when p->>'documentResource'='saleOrders' or tilebook.row_for(b,'saleOrders',(p->>'documentId')::uuid) is not null then 'saleOrders' else 'saleInvoices' end;
  doc:=tilebook.need_row(b,kind,p->>'documentId');
  if doc->>'partyId'<>party->>'id' or (doc->>'balance')::bigint<amt then raise exception 'Payment exceeds balance or party does not match'; end if;
  doc:=doc||jsonb_build_object('received',(doc->>'received')::bigint+amt,'balance',(doc->>'balance')::bigint-amt);
  if kind<>'saleOrders' then doc:=doc||jsonb_build_object('status',case when (doc->>'balance')::bigint=0 then 'Paid' else 'Part paid' end); end if;
  perform tilebook.put(b,kind,(doc->>'id')::uuid,doc,true);
  p:=p||jsonb_build_object('reference',doc->>'number','documentResource',kind);
 end if;
 return tilebook.put(b,'payments',i,p||jsonb_build_object('date',coalesce((p->>'date')::date,current_date),'direction',direction,'number',tilebook.number_for(b,'payments',case direction when 'in' then 'R' else 'PV' end),'partyName',party->>'name'));
end $$;

create function tilebook.archive_data(b uuid) returns jsonb language plpgsql set search_path='' as $$
declare m record; v jsonb; archive jsonb:='{}';
begin
 for m in select * from tilebook.resource_map where resource not in ('backups','audit','users','portalLinks','outbox','subscriptions') loop
 execute format('select coalesce(jsonb_agg(to_jsonb(t)),''[]'') from public.%I t where business_id=$1',m.table_name) into v using b;
 archive:=archive||jsonb_build_object(m.resource,v);
 end loop;
 return archive;
end $$;

create function public.tilebook_mutate(p_business_id uuid,p_resource text,p_action text,p_data jsonb,p_request_id uuid)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare b uuid:=tilebook.default_business(p_business_id); r text:=tilebook.my_role(b); k text:=p_resource;
 i uuid; p jsonb; before_row jsonb; result jsonb; doc jsonb; lot jsonb; item jsonb; price jsonb; prefs jsonb;
 loc text; target text; qty numeric; stock jsonb; branch jsonb; cost bigint; archive jsonb; m record; existing tilebook.operations;
 restore_id uuid; current_user_id uuid:=auth.uid(); rows_affected bigint; partner_record jsonb; acc numeric; balance numeric; counterparty text;
begin
 if jsonb_typeof(p_data) is distinct from 'object' or p_action not in ('create','update','restore') or p_request_id is null then raise exception 'Invalid mutation'; end if;
 if not tilebook.can_write(r,k) then raise exception 'Role cannot change %',k using errcode='42501'; end if;
 -- One tenant lock also serializes stock availability, reservations, invoice numbering and retry keys.
 perform pg_advisory_xact_lock(hashtext(b::text));
 select * into existing from tilebook.operations where business_id=b and request_id=p_request_id;
 if found then
  if existing.actor<>current_user_id or existing.input<>jsonb_build_array(k,p_action,p_data) then raise exception 'Request id already in use'; end if;
  return existing.result;
 end if;
 i:=case when p_action='update' then nullif(p_data->>'id','')::uuid else gen_random_uuid() end;
 if p_action='update' then
 if k not in ('parties','products','categories','services','cheques','loans','banks','slabs','partners','followUps','offers','reminders','campaigns','settings','printTemplates','subscriptions','complaints','attendance','users','bankEntries','approvals','priceLists','branches') then raise exception 'Posted transactions are immutable'; end if;
 before_row:=tilebook.need_row(b,k,i::text);
 end if;
 p:=(coalesce(before_row,'{}')||p_data)-array['id','createdAt','updatedAt','businessId','actorId'];
 p:=p||jsonb_build_object('createdBy',coalesce(before_row->>'createdBy',current_user_id::text));
 select payload->'value' into prefs from public.settings where business_id=b and payload->>'key'='preferences';
 if k in ('saleInvoices','estimates','proformas','saleOrders','challans','creditNotes','purchaseBills','purchaseOrders','debitNotes') then
 result:=tilebook.post_document(b,r,k,i,p);
 elsif k='payments' then
 if r='Counter' and p->>'direction'='out' then raise exception 'Counter can only receive payments' using errcode='42501'; end if;
 result:=tilebook.post_payment(b,i,p);
 elsif k='products' then
 if trim(coalesce(p->>'name',''))='' or coalesce((p->>'salePrice')::bigint,0)<0 or coalesce((p->>'purchasePrice')::bigint,0)<0 or coalesce((p->>'gstRate')::numeric,18) not between 0 and 100 or coalesce((p->>'piecesPerBox')::numeric,1)<=0 then raise exception 'Invalid product name, rate, GST or pieces per box'; end if;
 result:=tilebook.put(b,k,i,(jsonb_build_object('baseUnit','box','piecesPerBox',1,'sqftPerPiece',0,'gstRate',18,'salePrice',0)||p)-array['purchasePrice','openingQty','lotNo','shade'],p_action='update');
 if p ? 'purchasePrice' then
 insert into public.product_costs(business_id,payload) values(b,jsonb_build_object('productId',i,'purchasePrice',(p->>'purchasePrice')::bigint))
 on conflict(business_id,(payload->>'productId')) do update set payload=excluded.payload,updated_at=now();
 end if;
 if p_action='create' and nullif(p->>'lotNo','') is not null then
  perform public.tilebook_mutate(b,'lots','create',jsonb_build_object('productId',i,'lotNo',p->>'lotNo','shade',coalesce(nullif(p->>'shade',''),'Standard'),'openingQty',coalesce((p->>'openingQty')::numeric,0),'branchId',p->>'branchId'),gen_random_uuid());
 end if;
 elsif k='lots' then
 item:=tilebook.need_row(b,'products',p->>'productId');
 if trim(coalesce(p->>'lotNo',''))='' or trim(coalesce(p->>'shade',''))='' or coalesce((p->>'openingQty')::numeric,0)<0 then raise exception 'Enter a lot number, shade and valid opening quantity'; end if;
 loc:=coalesce(nullif(p->>'branchId',''),(select id::text from public.branches where business_id=b order by created_at,id limit 1));
 if loc is not null then perform tilebook.need_row(b,'branches',loc); end if;
 result:=tilebook.put(b,k,i,(p-'openingQty')||jsonb_build_object('receivedDate',coalesce((p->>'receivedDate')::date,current_date)));
 if coalesce((p->>'openingQty')::numeric,0)>0 then perform tilebook.move_stock(b,result,loc,i,'Opening',(p->>'openingQty')::numeric); end if;
 elsif k in ('damage','display','stockCounts','transfers') then
 lot:=tilebook.need_row(b,'lots',p->>'lotId'); item:=tilebook.need_row(b,'products',lot->>'productId');
 loc:=coalesce(nullif(p->>'fromBranchId',''),nullif(p->>'branchId',''),(select id::text from public.branches where business_id=b order by created_at,id limit 1));
 if loc is null then raise exception 'Choose a godown'; end if;
 branch:=tilebook.need_row(b,'branches',loc);
 stock:=tilebook.stock(b,lot->>'id',loc); qty:=(p->>'qty')::numeric;
 if k='stockCounts' then
 if (p->>'counted')::numeric is null or (p->>'counted')::numeric < (stock->>'reserved')::numeric+(stock->>'display')::numeric then raise exception 'Count cannot be lower than committed stock'; end if;
 qty:=(p->>'counted')::numeric-(stock->>'physical')::numeric;
 p:=p||jsonb_build_object('system',(stock->>'physical')::numeric,'systemQty',(stock->>'physical')::numeric,'difference',qty);
 perform tilebook.move_stock(b,lot,loc,i,k,qty);
 else
 if qty is null or qty<=0 or qty>(stock->>'sellable')::numeric then raise exception 'Quantity exceeds sellable stock'; end if;
 if k='damage' then
 select coalesce((payload->>'purchasePrice')::bigint,0) into cost from public.product_costs where business_id=b and payload->>'productId'=item->>'id';
 p:=p||jsonb_build_object('loss',round(qty*coalesce(cost,0)));
 perform tilebook.move_stock(b,lot,loc,i,k,-qty);
 elsif k='display' then perform tilebook.move_stock(b,lot,loc,i,k,0,0,qty);
 else target:=p->>'toBranchId'; perform tilebook.need_row(b,'branches',target);
 if target=loc then raise exception 'Select two different godowns'; end if;
 perform tilebook.move_stock(b,lot,loc,i,k,-qty);
 perform tilebook.move_stock(b,lot,target,i,k,qty);
 end if;
 end if;
 result:=tilebook.put(b,k,i,p||jsonb_build_object('date',coalesce((p->>'date')::date,current_date),'branchId',loc,'lotNo',lot->>'lotNo','shade',lot->>'shade','productId',item->>'id','productName',item->>'name'));
 elsif k='backups' then
 if p_action='restore' then
 restore_id:=(p_data->>'id')::uuid;
 select data into archive from tilebook.archives where id=restore_id and business_id=b;
 if archive is null then raise exception 'Backup unavailable'; end if;
 for m in select * from tilebook.resource_map where archive ? resource loop
 execute format('delete from public.%I where business_id=$1',m.table_name) using b;
 execute format('insert into public.%I select * from jsonb_populate_recordset(null::public.%I,$1)',m.table_name,m.table_name) using archive->m.resource;
 end loop;
 result:=tilebook.put(b,k,i,jsonb_build_object('name','Restored backup','sourceId',restore_id,'date',current_date));
 else
 archive:=tilebook.archive_data(b);
 insert into tilebook.archives values(i,b,now(),archive);
 result:=tilebook.put(b,k,i,jsonb_build_object('name',coalesce(nullif(p->>'name',''),'Business backup'),'date',current_date,'size',octet_length(archive::text),'status','Ready'));
 end if;
 else
 if not exists(select from tilebook.resource_map where resource=k) then raise exception 'Unknown resource'; end if;
 if k in ('parties','services','banks','categories','branches','expenseCategories','slabs') and trim(coalesce(p->>'name',p->>'slabNo',''))='' then raise exception 'Enter a name'; end if;
 if k='portalLinks' then
 update public.portal_links set payload=payload||'{"revoked":true}'::jsonb,updated_at=now()
 where business_id=b and payload->>'partyId'=p->>'partyId';
 p:=jsonb_build_object('partyId',p->>'partyId','token',replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),'expiresAt',now()+interval '30 days','revoked',false);
 end if;
 if k='settings' then
 if p->>'key' is null or jsonb_typeof(p->'value') is distinct from 'object' then raise exception 'Settings need a key and value'; end if;
 if p_action='create' then select id into restore_id from public.settings where business_id=b and payload->>'key'=p->>'key'; if found then i:=restore_id; p_action:='update'; end if; end if;
 end if;
 if k='partners' then
 perform tilebook.need_row(b,'parties',p->>'partyId');
 if p->>'kind' not in ('percent','box') or (p->>'rate')::numeric<0 or (p->>'rate') is null or (p->>'kind'='percent' and (p->>'rate')::numeric>100) then raise exception 'Invalid commission rule'; end if;
 end if;
 if k='commissionPayments' then
 select payload into partner_record from public.trade_partner_rules where business_id=b and id=(p->>'partnerId')::uuid;
 if found then p:=p||jsonb_build_object('partnerId',partner_record->>'partyId'); end if;
 perform tilebook.need_row(b,'parties',p->>'partnerId');
 select coalesce(sum((payload->>'amount')::numeric),0) into acc from public.commissions where business_id=b and payload->>'partnerId'=p->>'partnerId';
 select acc-coalesce(sum((payload->>'amount')::numeric),0) into balance from public.commission_payments where business_id=b and payload->>'partnerId'=p->>'partnerId';
 if (p->>'amount')::bigint is null or (p->>'amount')::bigint<=0 or (p->>'amount')::bigint>balance then raise exception 'Payment exceeds commission payable'; end if;
 end if;
 if k='users' then
 if p->>'role' is null or p->>'role' not in ('Manager','Counter','Godown','Accountant') then raise exception 'Select a staff role'; end if;
 counterparty:=regexp_replace(coalesce(p->>'phone',''),'[^0-9]','','g');
 if length(counterparty)=10 then counterparty:='91'||counterparty; end if;
 if counterparty!~'^[1-9][0-9]{10,14}$' then raise exception 'Invalid phone number'; end if;
 p:=(p-'userId')||jsonb_build_object('phone',counterparty,'status',coalesce(before_row->>'status','Invited'),'userId',before_row->>'userId');
 if before_row->>'status'='Active' then update public.memberships set role=p->>'role',updated_at=now() where business_id=b and user_id=(before_row->>'userId')::uuid and role<>'Owner'; end if;
 end if;
 if k='slabs' then
 if coalesce((p->>'length')::numeric,0)<=0 or coalesce((p->>'width')::numeric,0)<=0 then raise exception 'Enter positive slab dimensions in feet'; end if;
 if nullif(p->>'reservedFor','') is not null then perform tilebook.need_row(b,'parties',p->>'reservedFor'); end if;
 p:=p||jsonb_build_object('area',round((p->>'length')::numeric*(p->>'width')::numeric,2));
 end if;
 if k in ('expenses','commissionPayments','staffAdvances') and coalesce((p->>'amount')::bigint,0)<=0 then raise exception 'Enter a positive amount'; end if;
 if nullif(p->>'partyId','') is not null then perform tilebook.need_row(b,'parties',p->>'partyId'); end if;
 if nullif(p->>'lotId','') is not null then perform tilebook.need_row(b,'lots',p->>'lotId'); end if;
 result:=tilebook.put(b,k,i,p,p_action='update');
 end if;
 if coalesce((prefs->>'auditTrail')::boolean,true) or k in ('settings','users','backups') then
 perform tilebook.put(b,'audit',gen_random_uuid(),jsonb_build_object('actorId',current_user_id,'resource',k,'recordId',i,'action',p_action,'date',current_date,'before',before_row,'after',result));
 end if;
 if r in ('Counter','Godown') then result:=result-array['purchasePrice','cost','profit','loss','landedCost']; end if;
 result:=jsonb_build_object('row',result);
 insert into tilebook.operations values(b,p_request_id,current_user_id,jsonb_build_array(k,case when k='settings' and p_data->>'id' is null then 'create' else p_action end,p_data),result);
 return result;
end $$;
create unique index on public.trade_partner_rules(business_id,(payload->>'partyId'));
create unique index on public.staff_invitations(business_id,(payload->>'phone'));
revoke all on all functions in schema tilebook from public,anon,authenticated;
revoke all on function public.tilebook_accept_invites(),public.tilebook_snapshot(uuid),public.tilebook_mutate(uuid,text,text,jsonb,uuid) from public,anon;
grant execute on function public.tilebook_accept_invites(),public.tilebook_snapshot(uuid),public.tilebook_mutate(uuid,text,text,jsonb,uuid) to authenticated;

