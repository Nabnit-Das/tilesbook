-- Existing identities keep their enrollment state. New accounts remain pending
-- even when they use Supabase Auth directly instead of the TileBook form.
create or replace function tilebook.registration_password_state() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then
    if new.phone_confirmed_at is null or to_jsonb(new)->>'email_confirmed_at' is null then
      new.raw_app_meta_data := coalesce(new.raw_app_meta_data,'{}') || '{"tilebook_password_pending":true}'::jsonb;
    end if;
  elsif old.raw_app_meta_data @> '{"tilebook_password_pending":true}'::jsonb then
    if nullif(to_jsonb(new)->>'encrypted_password','') is not null
       and to_jsonb(new)->>'encrypted_password' is distinct from to_jsonb(old)->>'encrypted_password' then
      if new.phone_confirmed_at is null or to_jsonb(new)->>'email_confirmed_at' is null then
        raise exception 'Verify both contacts before setting a password' using errcode='42501';
      end if;
      new.raw_app_meta_data := coalesce(new.raw_app_meta_data,'{}') - 'tilebook_password_pending';
    else
      new.raw_app_meta_data := coalesce(new.raw_app_meta_data,'{}') || '{"tilebook_password_pending":true}'::jsonb;
    end if;
  end if;
  return new;
end $$;
