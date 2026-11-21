begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public,extensions;
select plan(2);
select is((select count(*) from storage.buckets
 where id in ('lot-photos','damage-photos','logos','generated-pdfs','backups','vein-match-photos','purchase-bills')
 and public=false),7::bigint,'All private storage buckets exist');
select is((select count(*) from pg_policies where schemaname='storage' and tablename='objects'
 and policyname in ('tilebook_files_read','tilebook_files_insert','tilebook_files_update','tilebook_files_delete')),4::bigint,'Storage has tenant-scoped read and write policies');
select * from finish();
rollback;

