-- Supabase OTP signup creates its own random password hash. Require a later
-- password change after both contact verifications for new phone-first owners.
create function tilebook.registration_password_state() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then
    if nullif(new.phone,'') is not null and nullif(to_jsonb(new)->>'email','') is null then
      new.raw_app_meta_data := coalesce(new.raw_app_meta_data,'{}') || '{"tilebook_password_pending":true}'::jsonb;
    end if;
  elsif old.raw_app_meta_data @> '{"tilebook_password_pending":true}'::jsonb then
    if nullif(to_jsonb(new)->>'encrypted_password','') is not null
      and to_jsonb(new)->>'encrypted_password' is distinct from to_jsonb(old)->>'encrypted_password'
      and new.phone_confirmed_at is not null and to_jsonb(new)->>'email_confirmed_at' is not null then
      new.raw_app_meta_data := coalesce(new.raw_app_meta_data,'{}') - 'tilebook_password_pending';
    else
      new.raw_app_meta_data := coalesce(new.raw_app_meta_data,'{}') || '{"tilebook_password_pending":true}'::jsonb;
    end if;
  end if;
  return new;
end $$;
revoke all on function tilebook.registration_password_state() from public,anon,authenticated;
create trigger tilebook_registration_password before insert or update on auth.users
for each row execute function tilebook.registration_password_state();

create or replace function public.tilebook_onboard(p_profile jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 perform public.tilebook_accept_invites();
 if not exists(select from public.memberships where user_id=auth.uid()) then
   if not exists(select from auth.users u where id=auth.uid() and nullif(to_jsonb(u)->>'email','') is not null
     and to_jsonb(u)->>'email_confirmed_at' is not null and phone_confirmed_at is not null
     and phone ~ '^[+]?91[6-9][0-9]{9}$') then
     raise exception 'Verified email and Indian mobile required' using errcode='42501';
   end if;
   if exists(select from auth.users where id=auth.uid() and raw_app_meta_data @> '{"tilebook_password_pending":true}'::jsonb) then
     raise exception 'Set a password before creating a workspace' using errcode='42501';
   end if;
 end if;
 return tilebook.tilebook_onboard(p_profile);
end $$;
