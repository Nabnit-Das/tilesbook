-- Keep the existing transaction and grant only the guarded entry point.
alter function public.tilebook_onboard(jsonb) set schema tilebook;
revoke all on function tilebook.tilebook_onboard(jsonb) from public, anon, authenticated;
create function public.tilebook_onboard(p_profile jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 perform public.tilebook_accept_invites();
 if not exists(select from public.memberships where user_id=auth.uid())
 and not exists(select from auth.users u where id=auth.uid() and nullif(to_jsonb(u)->>'email','') is not null
   and to_jsonb(u)->>'email_confirmed_at' is not null and phone_confirmed_at is not null
   and phone ~ '^[+]?91[6-9][0-9]{9}$') then
   raise exception 'Verified email and Indian mobile required' using errcode='42501';
 end if;
 return tilebook.tilebook_onboard(p_profile);
end $$;
revoke all on function public.tilebook_onboard(jsonb) from public,anon;
grant execute on function public.tilebook_onboard(jsonb) to authenticated;
