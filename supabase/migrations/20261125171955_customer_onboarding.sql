-- All membership discovery and provisioning use the caller's verified identity.
create or replace function public.tilebook_accept_invites() returns void
language plpgsql security definer set search_path='' as $$
declare ph text; invitation record;
begin
 select regexp_replace(phone,'[^0-9]','','g') into ph from auth.users where id=auth.uid() and phone_confirmed_at is not null;
 for invitation in select * from public.staff_invitations where regexp_replace(payload->>'phone','[^0-9]','','g')=ph and payload->>'status'='Invited' order by id for update loop
  insert into public.memberships(business_id,user_id,role) values(invitation.business_id,auth.uid(),invitation.payload->>'role') on conflict do nothing;
  update public.staff_invitations set payload=payload||jsonb_build_object('status','Active','userId',auth.uid()),updated_at=now() where id=invitation.id;
 end loop;
end $$;

create function public.tilebook_workspaces() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 perform public.tilebook_accept_invites();
 return (select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'name',b.name) order by b.name,b.id),'[]') from public.memberships m join public.businesses b on b.id=m.business_id where m.user_id=auth.uid());
end $$;

alter function public.tilebook_new_business(text,text,text) set schema tilebook;
revoke all on function tilebook.tilebook_new_business(text,text,text) from authenticated,anon,public;
create function public.tilebook_new_business(p_name text,p_state text,p_address text) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not exists(select from public.memberships where user_id=auth.uid() and role='Owner') then raise exception 'Owner permission required'; end if;
 return tilebook.tilebook_new_business(p_name,p_state,p_address);
end $$;

create function public.tilebook_onboard(p_profile jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare b uuid; k text;
begin
 if not exists(select from auth.users u where id=auth.uid() and (phone_confirmed_at is not null or to_jsonb(u)->>'email_confirmed_at' is not null)) then raise exception 'Verified identity required'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 perform public.tilebook_accept_invites();
 select business_id into b from public.memberships where user_id=auth.uid() order by created_at,business_id limit 1;
 if b is not null then return b; end if;
 foreach k in array array['ownerName','name','category','address','city','state','pin','phone','financialYear','language','gstStatus'] loop
  if jsonb_typeof(p_profile->k) is distinct from 'string' or length(btrim(p_profile->>k)) not between 1 and 400 then raise exception 'Invalid business profile'; end if;
 end loop;
 if octet_length(p_profile::text)>6000 or p_profile->>'category' not in ('tiles','sanitary','marble','mixed') or p_profile->>'pin' !~ '^[1-9][0-9]{5}$' or p_profile->>'phone' !~ '^[0-9]{10}$' or p_profile->>'financialYear' !~ '^20[0-9]{2}$' or p_profile->>'language' not in ('en','hi','or') or p_profile->>'gstStatus' not in ('registered','unregistered') or (p_profile->>'gstStatus'='registered' and coalesce(p_profile->>'gstin','') !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$') then raise exception 'Invalid business profile'; end if;
 b:=tilebook.tilebook_new_business(p_profile->>'name',p_profile->>'state',p_profile->>'address');
 update public.businesses set details=details||jsonb_build_object('ownerName',p_profile->>'ownerName','category',p_profile->>'category','city',p_profile->>'city','pin',p_profile->>'pin','phone',p_profile->>'phone','financialYear',p_profile->>'financialYear','gstStatus',p_profile->>'gstStatus','gstin',case when p_profile->>'gstStatus'='registered' then p_profile->>'gstin' else '' end) where id=b;
 update public.settings set payload=jsonb_set(payload,'{value,language}',p_profile->'language') where business_id=b and payload->>'key'='preferences';
 return b;
end $$;

create function public.tilebook_revoke_staff(p_business_id uuid,p_invitation uuid) returns void language plpgsql security definer set search_path='' as $$
declare staff jsonb;
begin
 if tilebook.my_role(p_business_id) is distinct from 'Owner' then raise exception 'Owner permission required'; end if;
 perform pg_advisory_xact_lock(hashtext(p_business_id::text));
 select payload into strict staff from public.staff_invitations where business_id=p_business_id and id=p_invitation for update;
 delete from public.memberships where business_id=p_business_id and user_id=(staff->>'userId')::uuid and role<>'Owner';
 update public.staff_invitations set payload=payload||'{"status":"Revoked"}',updated_at=now() where business_id=p_business_id and id=p_invitation;
end $$;
revoke all on function public.tilebook_workspaces(),public.tilebook_onboard(jsonb),public.tilebook_new_business(text,text,text),public.tilebook_revoke_staff(uuid,uuid) from public,anon;
grant execute on function public.tilebook_workspaces(),public.tilebook_onboard(jsonb),public.tilebook_new_business(text,text,text),public.tilebook_revoke_staff(uuid,uuid) to authenticated;
