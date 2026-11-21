create function public.tilebook_health() returns boolean language sql stable set search_path='' as
$$select true from (select count(*) from public.businesses) checks$$;
-- Execute the health query without allowing anonymous reads of business records.
alter function public.tilebook_health() security definer;
grant execute on function public.tilebook_health() to anon,authenticated;
-- Object paths start with the business UUID. Hosted storage enforces the same membership boundary.
create function public.tilebook_can_access_file(folder text,bucket text,writing boolean) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare r text;
begin
 if folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
 r:=tilebook.my_role(folder::uuid);
 if r is null or (writing and r='Accountant') then return false; end if;
 if bucket='backups' then return r='Owner'; end if;
 if bucket='logos' and writing then return r='Owner'; end if;
 if bucket='generated-pdfs' then return r in ('Owner','Manager','Accountant'); end if;
 return bucket in ('lot-photos','damage-photos','logos','vein-match-photos');
end $$;
revoke all on function public.tilebook_can_access_file(text,text,boolean) from public,anon;
grant execute on function public.tilebook_can_access_file(text,text,boolean) to authenticated;
do $storage$
declare bucket text;
begin
 if to_regclass('storage.buckets') is null then return; end if;
 foreach bucket in array array['lot-photos','damage-photos','logos','generated-pdfs','backups','vein-match-photos'] loop
 execute 'insert into storage.buckets(id,name,public) values($1,$1,false) on conflict(id) do update set public=false' using bucket;
 end loop;
 execute 'create policy tilebook_files_read on storage.objects for select to authenticated using(public.tilebook_can_access_file((storage.foldername(name))[1],bucket_id,false))';
 execute 'create policy tilebook_files_insert on storage.objects for insert to authenticated with check(public.tilebook_can_access_file((storage.foldername(name))[1],bucket_id,true))';
 execute 'create policy tilebook_files_update on storage.objects for update to authenticated using(public.tilebook_can_access_file((storage.foldername(name))[1],bucket_id,true)) with check(public.tilebook_can_access_file((storage.foldername(name))[1],bucket_id,true))';
 execute 'create policy tilebook_files_delete on storage.objects for delete to authenticated using(public.tilebook_can_access_file((storage.foldername(name))[1],bucket_id,true))';
end $storage$;

