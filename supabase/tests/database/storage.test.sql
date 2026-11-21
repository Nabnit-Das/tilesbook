begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public,extensions;
select plan(6);
select is((select count(*) from storage.buckets
 where id in ('lot-photos','damage-photos','logos','generated-pdfs','backups','vein-match-photos','purchase-bills')
 and public=false),7::bigint,'All private storage buckets exist');
select is((select count(*) from pg_policies where schemaname='storage' and tablename='objects'
 and policyname in ('tilebook_files_read','tilebook_files_insert','tilebook_files_update','tilebook_files_delete')),4::bigint,'Storage has tenant-scoped read and write policies');
-- Only transactional test metadata is created. Storage object bytes are untouched.
insert into storage.objects(bucket_id,name) values
 ('purchase-bills','10000000-0000-4000-8000-000000000001/tilebook-test.pdf'),
 ('lot-photos','10000000-0000-4000-8000-000000000001/tilebook-test.jpg'),
 ('lot-photos','20000000-0000-4000-8000-000000000099/tilebook-test.jpg');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is((select count(*) from storage.objects where name like '%/tilebook-test.%'),2::bigint,'Owner sees own files only');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select is((select count(*) from storage.objects where name like '%/tilebook-test.%'),1::bigint,'Counter sees own lot photo only');
select ok(not exists(select from storage.objects where bucket_id='purchase-bills' and name like '%/tilebook-test.%'),'Counter cannot retrieve supplier bill');
select throws_ok($$insert into storage.objects(bucket_id,name) values('lot-photos','20000000-0000-4000-8000-000000000099/foreign.png')$$,'42501',null,'Counter cannot store a file in a foreign prefix');
reset role;
select * from finish();
rollback;

