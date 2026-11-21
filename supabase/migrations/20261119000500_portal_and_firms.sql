create unique index portal_token on public.portal_links((payload->>'token'));
create function public.tilebook_portal(p_token text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare b uuid; party_id text; party jsonb; company jsonb; docs jsonb:='[]'; rows jsonb; bal numeric;
 m record;
begin
 if length(p_token)<>64 or p_token!~'^[0-9a-f]+$' then return null; end if;
 select business_id,payload->>'partyId' into b,party_id from public.portal_links
 where payload->>'token'=p_token and (payload->>'expiresAt')::timestamptz>now() and payload->>'revoked'='false';
 if b is null then return null; end if;
 party:=tilebook.row_for(b,'parties',party_id::uuid);
 if party is null then return null; end if;
 select jsonb_build_object('name',name,'address',details->>'address','phone',details->>'phone') into company from public.businesses where id=b;
 for m in select * from tilebook.resource_map where resource in ('saleInvoices','estimates','proformas','saleOrders','challans','creditNotes') loop
 execute format('select coalesce(jsonb_agg(jsonb_build_object(''id'',id,''kind'',$3::text,''date'',payload->>''date'',''number'',payload->>''number'',''status'',payload->>''status'',''total'',payload->''total'',''balance'',payload->''balance'',''sourceId'',payload->>''sourceId'') order by payload->>''date'' desc),''[]'') from public.%I where business_id=$1 and payload->>''partyId''=$2',m.table_name) into rows using b,party_id,m.resource;
 docs:=docs||rows;
 end loop;
 select coalesce((party->>'openingBalance')::numeric,0)
 +coalesce((select sum((payload->>'total')::numeric) from public.sale_invoices where business_id=b and payload->>'partyId'=party_id),0)
 -coalesce((select sum((payload->>'total')::numeric) from public.credit_notes where business_id=b and payload->>'partyId'=party_id),0)
 -coalesce((select sum((payload->>'amount')::numeric) from public.payments where business_id=b and payload->>'partyId'=party_id and payload->>'direction'='in'),0) into bal;
 return jsonb_build_object('business',company,'party',jsonb_build_object('name',party->>'name'),'documents',docs,'balance',bal);
end $$;
grant execute on function public.tilebook_portal(text) to anon,authenticated;

create function public.tilebook_new_business(p_name text,p_state text,p_address text) returns uuid
language plpgsql security definer set search_path='' as $$
declare b uuid:=gen_random_uuid();
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if length(trim(p_name)) not between 1 and 120 or length(trim(p_state)) not between 1 and 80 or length(p_address)>400 then raise exception 'Enter valid firm details'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if (select count(*) from public.memberships where user_id=auth.uid() and role='Owner')>=25 then raise exception 'Firm limit reached'; end if;
 insert into public.businesses(id,name,details) values(b,trim(p_name),jsonb_build_object('state',trim(p_state),'address',p_address));
 insert into public.memberships(business_id,user_id,role) values(b,auth.uid(),'Owner');
 perform tilebook.put(b,'branches',gen_random_uuid(),jsonb_build_object('name','Main Godown'));
 perform tilebook.put(b,'subscriptions',gen_random_uuid(),jsonb_build_object('plan','Trial','startDate',current_date,'trialEnds',current_date+14,'status','Active'));
 perform tilebook.put(b,'settings',gen_random_uuid(),'{"key":"preferences","value":{"simpleMode":true,"auditTrail":true,"language":"en","stopNegativeStock":true}}');
 return b;
end $$;
revoke all on function public.tilebook_new_business(text,text,text) from public,anon;
grant execute on function public.tilebook_new_business(text,text,text) to authenticated;

