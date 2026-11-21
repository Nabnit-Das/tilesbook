-- Supplier bill images expose purchase rates. Keep their bucket restricted
-- even when a restricted role knows the object's tenant and file name.
create or replace function public.tilebook_can_access_file(folder text,bucket text,writing boolean) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare r text;
begin
 if folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
 r:=tilebook.my_role(folder::uuid);
 if r is null or (writing and r='Accountant') then return false; end if;
 if bucket='backups' then return r='Owner'; end if;
 if bucket='logos' and writing then return r='Owner'; end if;
 if bucket in ('purchase-bills','generated-pdfs') then return r in ('Owner','Manager','Accountant'); end if;
 return bucket in ('lot-photos','damage-photos','logos','vein-match-photos');
end $$;
do $storage$
begin
 if to_regclass('storage.buckets') is not null then
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('purchase-bills','purchase-bills',false,15728640,array['image/jpeg','image/png','image/webp','application/pdf'])
  on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
 end if;
end $storage$;
