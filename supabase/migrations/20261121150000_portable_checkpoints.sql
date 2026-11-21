-- Retain a small independent proof so an exported checkpoint can be recovered
-- even when its bulky archive row is no longer available.
create table tilebook.export_proofs(business_id uuid references public.businesses(id), archive_id uuid, digest bytea not null, primary key(business_id,archive_id));
revoke all on tilebook.export_proofs from public,anon,authenticated;
create function public.tilebook_backup_file(p_business_id uuid,p_file text default null,p_confirm boolean default false)
returns text language plpgsql security definer set search_path='' as $$
declare b uuid:=tilebook.default_business(p_business_id); doc jsonb; aid uuid; a tilebook.archives; result jsonb; checksum bytea;
begin
 if tilebook.my_role(b)<>'Owner' then raise exception 'Owner permission required'; end if;
 perform pg_advisory_xact_lock(hashtext(b::text));
 if p_file is null then
  result:=public.tilebook_mutate(b,'backups','create',jsonb_build_object('name','Portable checkpoint'),gen_random_uuid());
  select * into strict a from tilebook.archives where business_id=b and id=(result#>>'{row,id}')::uuid;
  doc:=jsonb_build_object('format','tilebook-checkpoint-v2','businessId',b,'archiveId',a.id,'captured',a.saved_at,'data',a.data,'requests',a.known_requests);
  if octet_length(doc::text)>20000000 then raise exception 'Checkpoint exceeds 20 MB file limit'; end if;
  insert into tilebook.export_proofs values(b,a.id,sha256(convert_to(doc::text,'UTF8')));
  return doc::text;
 end if;
 if p_confirm is not true or octet_length(p_file)>20000000 then raise exception 'Confirmed file of at most 20 MB required'; end if;
 doc:=p_file::jsonb; aid:=(doc->>'archiveId')::uuid;
 select digest into checksum from tilebook.export_proofs where business_id=b and archive_id=aid;
 if doc->>'format' is distinct from 'tilebook-checkpoint-v2' or doc->>'businessId' is distinct from b::text or checksum is distinct from sha256(convert_to(doc::text,'UTF8')) then raise exception 'Unrecognised, modified or foreign checkpoint'; end if;
 insert into tilebook.archives(id,business_id,saved_at,data,known_requests) values(aid,b,(doc->>'captured')::timestamptz,doc->'data','{}') on conflict(id) do nothing;
 update tilebook.archives set known_requests=array(select jsonb_array_elements_text(doc->'requests')::uuid) where id=aid and business_id=b;
 perform public.tilebook_mutate(b,'backups','create',jsonb_build_object('name','Before file restore'),gen_random_uuid());
 perform public.tilebook_mutate(b,'backups','restore',jsonb_build_object('id',aid),gen_random_uuid());
 return 'Restored';
end $$;
revoke all on function public.tilebook_backup_file(uuid,text,boolean) from public,anon;
grant execute on function public.tilebook_backup_file(uuid,text,boolean) to authenticated;