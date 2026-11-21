-- Illustrative Indian business data, local fixtures only. All balances are paise.
create or replace function pg_temp.fixture(grp int,n int) returns uuid language sql immutable as $$
 select (lpad(grp::text,8,'0')||'-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
insert into auth.users (id,instance_id,aud,role,phone,phone_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,confirmation_token,recovery_token,email_change_token_new,email_change)
values ('00000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','919999999999',now(),now(),now(),'{"provider":"phone","providers":["phone"]}','{}','','','',''),
('00000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','919999999998',now(),now(),now(),'{"provider":"phone","providers":["phone"]}','{}','','','','');
insert into auth.identities(id,user_id,provider_id,identity_data,provider,created_at,updated_at)
select gen_random_uuid(),id,id::text,jsonb_build_object('sub',id,'phone',phone,'phone_verified',true),'phone',now(),now() from auth.users
where id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');
insert into public.businesses(id,name,details) values
 ('10000000-0000-4000-8000-000000000001','Demo Marbles & Tiles','{"address":"Khandagiri, Bhubaneswar, Odisha 751030","phone":"9437179877","gstin":"21ABCDE1234F1Z5","state":"Odisha","stateCode":"21","upiId":"demomarbles@sbi"}');
insert into public.memberships(business_id,user_id,role) values
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Owner'),
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','Counter');

do $seed$
declare b uuid:='10000000-0000-4000-8000-000000000001'; owner_id uuid:='00000000-0000-4000-8000-000000000001'; j int;
 products text[]:=array['2x2 Glossy White Vitrified','Tile Adhesive 20 kg','2x4 Statuario Glossy','Ivory Travertine 600','Ocean Blue Wall Tile','Kota Grey Matt','Kalinga Wood Plank','Terrazzo Pearl','Beige Marble Slab','Raw Granite Block','Pedestal Wash Basin','Wall-Hung WC','Kitchen Sink SS304','P-Trap Pan','Chrome Basin Mixer','Rain Shower 8 inch','Square Floor Drain','Epoxy Grout 1 kg','Tile Spacer 2 mm','Black Galaxy Granite','Carrara Marble Slab','River White Slab','Sandstone Step','Mosaic Blue 300','Rustic Terracotta 400'];
 names text[]:=array['Sai Builders','Das Homes','Ramesh Sahu','Bikash Naik','Gopal Pradhan','Patel Contractors','Kalinga Civil Works','Architect Das','Studio Mishra','Odisha Ceramics Supply','Kajaria Distributors','Nabnit Das','Swarup Interiors','Uma Mohanty','Balaji Projects','Bharati Traders','New Town Homes','Maa Tarini Constructions','Nila Designs','Shanti Residence'];
 units text[]:=array['box','bag','box','box','box','box','box','box','slab','block','piece','piece','piece','piece','piece','piece','piece','bag','bag','slab','slab','slab','piece','box','box'];
 party_type text; nm text; lotno text; shade text; pidx int; price int; unit text; rate int; hsn text; datesold date; doc jsonb; d jsonb; order_doc jsonb; return_doc jsonb; item jsonb; lines jsonb;
 branch uuid:=pg_temp.fixture(1,1); lot uuid:=pg_temp.fixture(3,1); first_item uuid:=pg_temp.fixture(2,1); supplier uuid:=pg_temp.fixture(4,10);
begin
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform tilebook.put(b,'branches',branch,'{"name":"Main Godown","address":"Khandagiri, Bhubaneswar"}');
 perform tilebook.put(b,'branches',pg_temp.fixture(1,2),'{"name":"Showroom","address":"Patia, Bhubaneswar"}');
 perform tilebook.put(b,'settings',gen_random_uuid(),'{"key":"preferences","value":{"simpleMode":true,"language":"en","auditTrail":true,"stopNegativeStock":true,"warnMixedLots":true,"deadStockDays":180,"sqftConverter":true,"forceLot":true,"displayStock":true,"tradePartnerCommission":true}}');
 perform tilebook.put(b,'subscriptions',gen_random_uuid(),jsonb_build_object('name','Free trial','plan','Trial','startDate',current_date,'trialEnds',current_date+14,'status','Active'));
 perform tilebook.put(b,'users',gen_random_uuid(),'{"name":"Counter 1","role":"Counter","phone":"919999999998","status":"Active","userId":"00000000-0000-4000-8000-000000000002"}');
 foreach nm in array array['Floor tiles','Wall tiles','Natural stone','Sanitaryware','Adhesive and grout'] loop perform tilebook.put(b,'categories',gen_random_uuid(),jsonb_build_object('name',nm)); end loop;
 foreach nm in array array['Freight','Unloading','Rent','Staff','Electricity'] loop perform tilebook.put(b,'expenseCategories',gen_random_uuid(),jsonb_build_object('name',nm)); end loop;
 perform tilebook.put(b,'services',gen_random_uuid(),'{"name":"Tile installation","hsn":"9954","gstRate":18,"salePrice":5500,"baseUnit":"sqft"}');
 for j in 1..20 loop
 party_type:=case when j between 3 and 5 then 'Mason' when j between 6 and 7 then 'Contractor' when j between 8 and 9 then 'Architect' when j in (1,2,15) then 'Builder' when j in (10,11) then 'Supplier' else 'Customer' end;
 perform tilebook.put(b,'parties',pg_temp.fixture(4,j),jsonb_build_object('name',names[j],'type',party_type,'phone',case when j=1 then '9876543210' else (9437000100::bigint+j)::text end,'address',case when j=1 then 'Patia, Bhubaneswar' else 'Bhubaneswar, Odisha' end,'shippingAddress',case when j=1 then 'Site, Chandaka Road' else 'Bhubaneswar, Odisha' end,'state','Odisha','gstin',case when j=1 then '21AAAAA0000A1Z5' else '' end,'openingBalance',0,'creditLimit',case when j=1 then 25000000 else 0 end,'priceList','Retail'));
 end loop;
 for j in 1..25 loop
 unit:=units[j]; price:=case j when 1 then 319600 when 2 then 52000 else (790+j*37)*100 end;
 rate:=case when j=10 then 5 else 18 end;
 hsn:=case j when 2 then '3214' when 9 then '6802' when 10 then '2516' else case when unit='box' then '6907' when unit='piece' then '6910' else '6802' end end;
 perform tilebook.put(b,'products',pg_temp.fixture(2,j),jsonb_build_object('name',products[j],'category',case when j in (2,18,19) then 'Adhesive and grout' when unit in ('slab','block') then 'Natural stone' when unit='box' then 'Floor tiles' else 'Sanitaryware' end,'brand',case j%3 when 0 then 'Kalinga' when 1 then 'Utkal' else 'Konark' end,'design',products[j],'finish',case when j%3=0 then 'Matt' else 'Glossy' end,'size',case when j=3 then '600 × 1200 mm' when unit='box' then '600 × 600 mm' else '' end,'hsn',hsn,'gstRate',rate,'baseUnit',unit,'sqftPerPiece',case when j=3 then 8 when unit='box' then 4 else 0 end,'piecesPerBox',case when unit='box' then 4 else 1 end,'salePrice',price,'lowStockLevel',20,'barcode','8901000'||lpad(j::text,6,'0')));
 perform tilebook.put(b,'productCosts',gen_random_uuid(),jsonb_build_object('productId',pg_temp.fixture(2,j),'purchasePrice',round(price*0.76)));
 end loop;
 for j in 1..12 loop
 pidx:=case when j=12 then 1 else j end;
 lotno:=case j when 1 then '2531' when 12 then '2416' else (2600+j)::text end; shade:=case j when 1 then 'A3' when 12 then 'A2' else 'S'||j end;
 datesold:=case when j=12 then current_date-210 else current_date-(j*2) end;
 d:=tilebook.put(b,'lots',pg_temp.fixture(3,j),jsonb_build_object('productId',pg_temp.fixture(2,pidx),'lotNo',lotno,'shade',shade,'supplierId',supplier,'receivedDate',datesold-14,'lastSoldDate',datesold));
 perform tilebook.move_stock(b,d,branch::text,(d->>'id')::uuid,'Opening',case when j=1 then 1200 when j=12 then 40 when j=6 then 10 else 100+j*7 end);
 end loop;
 perform tilebook.put(b,'partners',gen_random_uuid(),jsonb_build_object('partyId',pg_temp.fixture(4,3),'kind','percent','rate',2,'lastContact',current_date-5));
 perform tilebook.put(b,'partners',gen_random_uuid(),jsonb_build_object('partyId',pg_temp.fixture(4,8),'kind','percent','rate',3,'lastContact',current_date-62));
 perform tilebook.put(b,'banks',pg_temp.fixture(6,1),'{"name":"SBI Current","bankName":"State Bank of India","accountNo":"1234567890","ifsc":"SBIN0001234","upiId":"demomarbles@sbi","openingBalance":48200000}');
 perform tilebook.put(b,'banks',pg_temp.fixture(6,2),'{"name":"HDFC Savings","bankName":"HDFC Bank","accountNo":"5020012345","ifsc":"HDFC0000765","openingBalance":7600000}');
 perform tilebook.put(b,'cheques',gen_random_uuid(),jsonb_build_object('name','Sai Builders','number','000555','partyId',pg_temp.fixture(4,1),'amount',4000000,'date',current_date+10,'status','Open'));
 perform tilebook.put(b,'loans',gen_random_uuid(),jsonb_build_object('name','HDFC Business Loan','principal',80000000,'rate',11,'months',36,'date',current_date,'emi',2619100));
 for j in 1..30 loop
 if j=13 then
 lines:=jsonb_build_array(jsonb_build_object('productId',first_item,'lotId',lot,'qty',23,'rate',319600),jsonb_build_object('productId',pg_temp.fixture(2,2),'lotId',pg_temp.fixture(3,2),'qty',6,'rate',52000));
 else
 pidx:=case when j%5=0 then 3 else 1 end;
 lines:=jsonb_build_array(jsonb_build_object('productId',pg_temp.fixture(2,pidx),'lotId',pg_temp.fixture(3,pidx),'qty',1+j%7,'rate',case when pidx=1 then 319600 else 90100 end));
 end if;
 doc:=tilebook.post_document(b,'Owner','saleInvoices',pg_temp.fixture(5,j),jsonb_build_object('number','INV-'||(100+j),'date',case when j=13 then date '2026-11-19' else current_date-(j%22) end,'dueDate',case when j=13 then date '2026-11-30' else current_date+14 end,'partyId',case when j=13 then pg_temp.fixture(4,1) else pg_temp.fixture(4,(j%8)+12) end,'partnerId',case when j=13 or j%4=0 then pg_temp.fixture(4,3) else null end,'lines',lines,'received',case when j=13 then 5000000 when j%3=0 then 40000 else 0 end,'paymentMode',case when j=13 then 'UPI' else 'Cash' end,'bankId',case when j=13 then pg_temp.fixture(6,1) else null end,'salesperson','Counter 1','vehicleNo',case when j=13 then 'OD02 AB 1234' else '' end,'orderReference',case when j=13 then 'SO-1' else '' end,'challanReference',case when j=13 then 'DC-1' else '' end));
 end loop;
 insert into tilebook.counters values(b,'saleInvoices',130);
 for j in 1..5 loop
 order_doc:=tilebook.post_document(b,'Owner','saleOrders',pg_temp.fixture(7,j),jsonb_build_object('partyId',pg_temp.fixture(4,case when j=1 then 2 else j+10 end),'date',current_date-10,'dueDate',current_date-3+j,'lines',jsonb_build_array(jsonb_build_object('productId',first_item,'lotId',lot,'qty',case when j=1 then 200 else j*6 end,'rate',319600)),'received',case when j=1 then 1000000 else j*12000 end));
 if j=1 then
 for pidx in 1..2 loop
 perform tilebook.post_document(b,'Owner','challans',gen_random_uuid(),jsonb_build_object('partyId',order_doc->>'partyId','date',current_date-3+pidx,'sourceId',order_doc->>'id','lines',jsonb_build_array(jsonb_build_object('productId',first_item,'lotId',lot,'sourceLineId',order_doc#>>'{lines,0,id}','qty',case pidx when 1 then 60 else 80 end,'rate',319600))));
 end loop;
 end if;
 end loop;
 for j in 1..3 loop
 doc:=tilebook.need_row(b,'saleInvoices',pg_temp.fixture(5,j)::text);
 return_doc:=tilebook.post_document(b,'Owner','creditNotes',gen_random_uuid(),jsonb_build_object('partyId',doc->>'partyId','sourceId',doc->>'id','date',current_date-j,'lines',jsonb_build_array(jsonb_build_object('sourceLineId',doc#>>'{lines,0,id}','productId',first_item,'lotId',lot,'qty',1,'rate',319600))));
 end loop;
 for j in 1..6 loop
 perform public.tilebook_mutate(b,'damage','create',jsonb_build_object('lotId',lot,'qty',case when j=1 then 6 else 1 end,'reason',(array['Factory transit','Godown handling','Delivery','Showroom'])[(j%4)+1],'responsible','Raju','date',current_date-j),gen_random_uuid());
 end loop;
 perform public.tilebook_mutate(b,'display','create',jsonb_build_object('lotId',lot,'qty',1,'location','Showroom wall'),gen_random_uuid());
 perform tilebook.post_document(b,'Owner','estimates',gen_random_uuid(),jsonb_build_object('partyId',pg_temp.fixture(4,2),'lines',jsonb_build_array(jsonb_build_object('productId',first_item,'lotId',lot,'qty',23,'rate',319600,'room','Living room floor'),jsonb_build_object('productId',pg_temp.fixture(2,2),'qty',6,'rate',52000,'room','Bathroom wall'))));
 perform tilebook.post_document(b,'Owner','purchaseBills',gen_random_uuid(),jsonb_build_object('partyId',supplier,'received',0,'freight',180000,'lines',jsonb_build_array(jsonb_build_object('productId',first_item,'lotId',lot,'qty',30,'rate',245000))));
 perform tilebook.put(b,'commissionPayments',gen_random_uuid(),jsonb_build_object('partnerId',pg_temp.fixture(4,3),'amount',100000,'date',current_date-2,'mode','UPI'));
 perform tilebook.put(b,'followUps',gen_random_uuid(),jsonb_build_object('name','Confirm living-room estimate','partyId',pg_temp.fixture(4,2),'date',current_date,'status','Pending'));
 perform tilebook.put(b,'offers',gen_random_uuid(),jsonb_build_object('name','Clearance on lot 2416','lotId',pg_temp.fixture(3,12),'discount',10,'status','Draft'));
 perform tilebook.put(b,'slabs',gen_random_uuid(),'{"name":"Beige Marble","slabNo":"M14-01","length":9,"width":5.5,"area":49.5,"status":"Available"}');
 perform tilebook.put(b,'expenses',gen_random_uuid(),jsonb_build_object('name','Unloading charges','category','Unloading','amount',320000,'mode','Cash','date',current_date-2));
end $seed$;

