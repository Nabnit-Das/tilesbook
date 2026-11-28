-- Existing identities keep their enrollment state. New accounts remain pending
-- even when they use Supabase Auth directly instead of the TileBook form.
create or replace function tilebook.registration_password_state() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then
    if to_jsonb(new)->>'email_confirmed_at' is null then
      new.raw_app_meta_data := coalesce(new.raw_app_meta_data,'{}') || '{"tilebook_password_pending":true}'::jsonb;
    end if;
  elsif old.raw_app_meta_data @> '{"tilebook_password_pending":true}'::jsonb then
    if nullif(to_jsonb(new)->>'encrypted_password','') is not null
       and to_jsonb(new)->>'encrypted_password' is distinct from to_jsonb(old)->>'encrypted_password' then
      if to_jsonb(new)->>'email_confirmed_at' is null then
        raise exception 'Verify your email before setting a password' using errcode='42501';
      end if;
      new.raw_app_meta_data := coalesce(new.raw_app_meta_data,'{}') - 'tilebook_password_pending';
    else
      new.raw_app_meta_data := coalesce(new.raw_app_meta_data,'{}') || '{"tilebook_password_pending":true}'::jsonb;
    end if;
  end if;
  return new;
end $$;

create or replace function public.tilebook_accept_invites() returns void
language plpgsql security definer set search_path='' as $$
declare ph text; verified_email text; invitation record;
begin
 select regexp_replace(phone,'[^0-9]','','g') into ph from auth.users where id=auth.uid() and phone_confirmed_at is not null;
 select lower(nullif(to_jsonb(u)->>'email','')) into verified_email from auth.users u where id=auth.uid() and to_jsonb(u)->>'email_confirmed_at' is not null;
 for invitation in select * from public.staff_invitations where (lower(btrim(payload->>'email'))=verified_email or (nullif(payload->>'email','') is null and ph<>'' and regexp_replace(payload->>'phone','[^0-9]','','g')=ph)) and payload->>'status'='Invited' order by id for update loop
  insert into public.memberships(business_id,user_id,role) values(invitation.business_id,auth.uid(),invitation.payload->>'role') on conflict do nothing;
  update public.staff_invitations set payload=payload||jsonb_build_object('status','Active','userId',auth.uid()),updated_at=now() where id=invitation.id;
 end loop;
end $$;


create or replace function tilebook.tilebook_onboard(p_profile jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare b uuid; k text;
begin
 if not exists(select from auth.users u where id=auth.uid() and to_jsonb(u)->>'email_confirmed_at' is not null) then raise exception 'Verified identity required'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 perform public.tilebook_accept_invites();
 select business_id into b from public.memberships where user_id=auth.uid() order by created_at,business_id limit 1;
 if b is not null then return b; end if;
 foreach k in array array['ownerName','name','category','address','city','state','pin','financialYear','language','gstStatus'] loop
  if jsonb_typeof(p_profile->k) is distinct from 'string' or length(btrim(p_profile->>k)) not between 1 and 400 then raise exception 'Invalid business profile'; end if;
 end loop;
 if octet_length(p_profile::text)>6000 or p_profile->>'category' not in ('tiles','sanitary','marble','mixed') or p_profile->>'pin' !~ '^[1-9][0-9]{5}$' or coalesce(p_profile->>'phone','') !~ '^([0-9]{10})?$' or p_profile->>'financialYear' !~ '^20[0-9]{2}$' or p_profile->>'language' not in ('en','hi','or') or p_profile->>'gstStatus' not in ('registered','unregistered') or (p_profile->>'gstStatus'='registered' and coalesce(p_profile->>'gstin','') !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$') then raise exception 'Invalid business profile'; end if;
 b:=tilebook.tilebook_new_business(p_profile->>'name',p_profile->>'state',p_profile->>'address');
 update public.businesses set details=details||jsonb_build_object('ownerName',p_profile->>'ownerName','category',p_profile->>'category','city',p_profile->>'city','pin',p_profile->>'pin','phone',p_profile->>'phone','financialYear',p_profile->>'financialYear','gstStatus',p_profile->>'gstStatus','gstin',case when p_profile->>'gstStatus'='registered' then p_profile->>'gstin' else '' end) where id=b;
 update public.settings set payload=jsonb_set(payload,'{value,language}',p_profile->'language') where business_id=b and payload->>'key'='preferences';
 return b;
end $$;

create or replace function public.tilebook_onboard(p_profile jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 perform public.tilebook_accept_invites();
 if not exists(select from public.memberships where user_id=auth.uid()) then
   if not exists(select from auth.users u where id=auth.uid() and nullif(to_jsonb(u)->>'email','') is not null
     and to_jsonb(u)->>'email_confirmed_at' is not null) then
     raise exception 'Verified email required' using errcode='42501';
   end if;
   if exists(select from auth.users where id=auth.uid() and raw_app_meta_data @> '{"tilebook_password_pending":true}'::jsonb) then
     raise exception 'Set a password before creating a workspace' using errcode='42501';
   end if;
 end if;
 return tilebook.tilebook_onboard(p_profile);
end $$;
