-- Runs inside the disposable local database with the checked-in seed installed.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public,extensions;
select plan(13);
select is((select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity),0::bigint,'Every public table has RLS enabled');
-- Storage's own catalog is tested in storage.test.sql.

insert into public.businesses(id,name) values('20000000-0000-4000-8000-000000000099','Second shop');
insert into public.parties(id,business_id,payload) values('20000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000099','{"name":"Other shop only"}');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is((public.tilebook_snapshot()->'business'->>'name'),'Demo Marbles & Tiles','Owner can read own shop');
select ok(not exists(select from jsonb_array_elements(public.tilebook_snapshot()#>'{records,parties}') p where p->>'name'='Other shop only'),'Default scope excludes foreign rows');
select throws_ok($$select public.tilebook_snapshot('20000000-0000-4000-8000-000000000099')$$,'42501','Business access denied','Cannot switch to another tenant');
select throws_ok($$select public.tilebook_mutate('20000000-0000-4000-8000-000000000099','parties','create','{"name":"Unscoped"}',gen_random_uuid())$$,'42501','Business access denied','Cannot write another tenant');
select throws_ok($$select public.tilebook_mutate(null,'parties','update','{"id":"20000000-0000-4000-8000-000000000010","name":"Changed"}',gen_random_uuid())$$,'22023','Missing or inaccessible parties record','Foreign IDs cannot be updated through the current tenant');
select ok(public.tilebook_can_access_file('10000000-0000-4000-8000-000000000001','lot-photos',true),'Owner can upload a lot photo to own tenant');
select ok(not public.tilebook_can_access_file('20000000-0000-4000-8000-000000000099','lot-photos',true),'Owner cannot upload in a foreign prefix');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select is(public.tilebook_snapshot() ->> 'role','Counter','Counter identity resolves to the restricted role');
select ok(not exists(select from jsonb_array_elements(public.tilebook_snapshot()#>'{records,products}') p where p?'purchasePrice'),'Counter cannot read purchase prices');
select is(jsonb_array_length(public.tilebook_snapshot()#>'{records,purchaseBills}'),0,'Counter cannot read purchase lines or landed costs');
select throws_ok($$select * from public.product_costs$$,'42501','permission denied for table product_costs','Counter cannot bypass projection via the base table');
select throws_ok($$select public.tilebook_mutate(null,'purchaseBills','create','{}',gen_random_uuid())$$,'42501','Role cannot change purchaseBills','Counter cannot post a purchase');
reset role;
select * from finish();
rollback;

