create function tilebook.entitlements(b uuid) returns jsonb language plpgsql stable set search_path='' as $$
declare plan_name text; trial_end date; today_ist date:=(now() at time zone 'Asia/Kolkata')::date;
begin
 select lower(coalesce(s.payload->>'plan','trial')),
 least(coalesce((s.payload->>'trialEnds')::date,'infinity'::date),(f.created_at at time zone 'Asia/Kolkata')::date+14)
 into plan_name,trial_end from public.businesses f left join lateral
 (select payload from public.subscriptions where business_id=f.id order by updated_at desc,id limit 1) s on true where f.id=b;
 if plan_name='trial' and today_ist>=trial_end then plan_name:='basic'; end if;
 return jsonb_build_object('plan',plan_name,'premium',plan_name in ('trial','pro'),'trialEnds',trial_end);
end $$;
create table tilebook.daily_backups (
 business_id uuid not null references public.businesses(id) on delete cascade,
 local_day date not null,backup_id uuid not null,primary key(business_id,local_day)
);
create function tilebook.checkpoint_today(b uuid) returns void language plpgsql set search_path='' as $$
declare today_ist date:=(now() at time zone 'Asia/Kolkata')::date; backup_id uuid:=gen_random_uuid(); archive jsonb;
begin
 if not exists(select 1 from public.settings where business_id=b and payload->>'key'='preferences' and payload#>>'{value,autoBackup}'='true') then return; end if;
 insert into tilebook.daily_backups values(b,today_ist,backup_id) on conflict do nothing;
 if not found then return; end if;
 archive:=tilebook.archive_data(b);
 insert into tilebook.archives(id,business_id,data) values(backup_id,b,archive);
 perform tilebook.put(b,'backups',backup_id,jsonb_build_object('name','Daily backup · '||today_ist,'date',today_ist,'kind','automatic','size',octet_length(archive::text),'status','Ready'));
end $$;
alter function public.tilebook_snapshot(uuid) set schema tilebook;
revoke all on function tilebook.tilebook_snapshot(uuid) from public,anon,authenticated;
create function public.tilebook_snapshot(p_business_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare b uuid:=tilebook.default_business(p_business_id);
begin
 return tilebook.tilebook_snapshot(b)||jsonb_build_object('entitlements',tilebook.entitlements(b));
end $$;

alter function public.tilebook_mutate(uuid,text,text,jsonb,uuid) rename to approve_and_post;
alter function public.approve_and_post(uuid,text,text,jsonb,uuid) set schema tilebook;
revoke all on function tilebook.approve_and_post(uuid,text,text,jsonb,uuid) from public,anon,authenticated;
create function public.tilebook_mutate(p_business_id uuid,p_resource text,p_action text,p_data jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b uuid:=tilebook.default_business(p_business_id); r text:=tilebook.my_role(b);
begin
 if not tilebook.can_write(r,p_resource) then raise exception 'Role cannot change %',p_resource using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext(b::text));
 if not exists(select from tilebook.operations where business_id=b and request_id=p_request_id) then
  if (p_resource in ('campaigns','partners','slabs') or (p_resource='saleInvoices' and nullif(p_data->>'partnerId','') is not null))
   and tilebook.entitlements(b)->>'premium'='false' then raise exception 'Upgrade to Pro in Plans & Pricing to use this feature'; end if;
  if p_resource='subscriptions' and lower(coalesce(p_data->>'plan','')) not in ('trial','basic','pro') then raise exception 'Choose Trial, Basic or Pro'; end if;
  if p_resource<>'backups' then perform tilebook.checkpoint_today(b); end if;
 end if;
 return tilebook.approve_and_post(b,p_resource,p_action,p_data,p_request_id);
end $$;
revoke all on function tilebook.entitlements(uuid),tilebook.checkpoint_today(uuid),public.tilebook_snapshot(uuid),public.tilebook_mutate(uuid,text,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.tilebook_snapshot(uuid),public.tilebook_mutate(uuid,text,text,jsonb,uuid) to authenticated;
