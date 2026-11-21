create function tilebook.post_document(b uuid,actor_role text,k text,i uuid,input jsonb) returns jsonb
 language plpgsql set search_path='' as $$
declare
 d jsonb:=input; ln jsonb; result_lines jsonb:='[]'; item jsonb; lot jsonb; party jsonb; ref jsonb;
 src jsonb; sl jsonb; prefs jsonb; rule jsonb; casekey text; source_resource text; selected_branch text;
 qty numeric; base_qty numeric; price bigint; disc bigint; taxable bigint; tax bigint; cgst bigint; sgst bigint; igst bigint;
 subtotal bigint:=0; taxsum bigint:=0; csum bigint:=0; ssum bigint:=0; isum bigint:=0; total bigint; paid bigint; bill_discount bigint;
 receipt jsonb; payout bigint; partner text; boxes numeric:=0; original_boxes numeric; already numeric; open_balance numeric; units text;
 state text; intra boolean; work_id uuid; line_id text; source_line_id text; sidx int; prefix text;
 taxable_before bigint:=0; remaining_discount bigint; line_count int:=0; raw_amount bigint; extra_cost bigint; oldqty numeric; calc_cost bigint;
 order_open boolean; is_return boolean:=k in ('creditNotes','debitNotes'); tracked boolean; stock jsonb; user_id uuid:=auth.uid(); updated_source boolean:=false;
 gst numeric; order_ref jsonb; advance bigint:=0; refund bigint; shares numeric[]; bases numeric[]:='{}';
begin
 if jsonb_typeof(d->'lines') is distinct from 'array' then raise exception 'Add at least one line'; end if;
 if jsonb_array_length(d->'lines') not between 1 and 250 then raise exception 'Documents need between 1 and 250 lines'; end if;
 party:=tilebook.need_row(b,'parties',d->>'partyId');
 select details->>'state' into state from public.businesses where id=b;
 intra:=lower(coalesce(nullif(d->>'placeOfSupply',''),nullif(party->>'state',''),state))=lower(state);
 select payload->'value' into prefs from public.settings where business_id=b and payload->>'key'='preferences';
 prefs:=coalesce(prefs,'{}');
 selected_branch:=coalesce(nullif(d->>'branchId',''),(select id::text from public.branches where business_id=b order by created_at,id limit 1));
 if selected_branch is not null then perform tilebook.need_row(b,'branches',selected_branch); end if;
 d:=d || jsonb_build_object('branchId',selected_branch,'date',coalesce((nullif(d->>'date',''))::date,current_date),'placeOfSupply',coalesce(nullif(d->>'placeOfSupply',''),party->>'state',state));
 if exists(select 1 from jsonb_array_elements(d->'lines') x
  join public.products item_row on item_row.business_id=b and item_row.id=(x->>'productId')::uuid
  group by coalesce(nullif(lower(trim(item_row.payload->>'design')),''),x->>'productId')
  having count(distinct x->>'lotId')>1)
 and coalesce((prefs->>'warnMixedLots')::boolean,true) and k in ('saleInvoices','saleOrders','challans') then
  if actor_role<>'Owner' or length(trim(coalesce(d->>'overrideReason','')))<3 then raise exception 'Mixed lots require an owner override reason'; end if;
 end if;
 if k in ('creditNotes','debitNotes','challans') and nullif(d->>'sourceId','') is null then raise exception 'Choose the original document'; end if;
 -- A partner picker may send the CRM rule UUID or the referring party UUID.
 if nullif(d->>'partnerId','') is not null then
  select payload into rule from public.trade_partner_rules where business_id=b and id=(d->>'partnerId')::uuid;
  if found then d:=d||jsonb_build_object('partnerId',rule->>'partyId'); end if;
 end if;
 if nullif(d->>'sourceId','') is not null then
  source_resource:=case k when 'creditNotes' then 'saleInvoices' when 'debitNotes' then 'purchaseBills' when 'challans' then 'saleOrders' when 'saleOrders' then 'estimates' when 'purchaseBills' then 'purchaseOrders' when 'saleInvoices' then coalesce(nullif(d->>'sourceResource',''),'challans') end;
  if k='saleInvoices' and nullif(d->>'sourceResource','') is null then
   select candidate into source_resource from unnest(array['challans','estimates','proformas','saleOrders']) candidate where tilebook.row_for(b,candidate,(d->>'sourceId')::uuid) is not null limit 1;
  elsif k='saleOrders' and tilebook.row_for(b,'proformas',(d->>'sourceId')::uuid) is not null then source_resource:='proformas';
  end if;
  if k='saleInvoices' and source_resource='saleOrders' then
   -- Converting an order posts its dispatch first, releasing the reservation exactly once.
   ref:=tilebook.post_document(b,actor_role,'challans',gen_random_uuid(),d||jsonb_build_object('number',null,'received',0,'billDiscount',0));
   d:=d||jsonb_build_object('sourceId',ref->>'id','sourceResource','challans','lines',(select jsonb_agg(x||jsonb_build_object('sourceLineId',ref#>>array['lines',(ord-1)::text,'id']) order by ord) from jsonb_array_elements(d->'lines') with ordinality e(x,ord)));
   source_resource:='challans';
  end if;
  if source_resource is null or (k='saleInvoices' and source_resource not in ('challans','estimates','proformas')) then raise exception 'Invalid conversion path'; end if;
  src:=tilebook.need_row(b,source_resource,d->>'sourceId');
  if src->>'partyId'<>party->>'id' then raise exception 'Source belongs to another party'; end if;
  if src->>'status'='Converted' and not is_return then raise exception 'Document has already been converted'; end if;
  if k='creditNotes' then d:=d||jsonb_build_object('partnerId',src->>'partnerId'); end if;
 end if;
 -- Allocate a bill-level discount across the lines before computing each GST rate.
 bill_discount:=coalesce((d->>'billDiscount')::bigint,0);
 for ln in select * from jsonb_array_elements(d->'lines') loop
  item:=tilebook.need_row(b,'products',ln->>'productId');
  if k in ('purchaseBills','purchaseOrders','debitNotes') and nullif(ln->>'rate','') is null then raise exception 'Enter a purchase rate'; end if;
  qty:=(ln->>'qty')::numeric;
  price:=coalesce(nullif(ln->>'rate','')::bigint,(item->>'salePrice')::bigint,0);
  disc:=coalesce(nullif(ln->>'discount','')::bigint,0);
  if qty is null or qty<=0 or qty>100000000 or price<0 or disc<0 or disc>round(qty*price) then raise exception 'Invalid quantity, rate or discount'; end if;
  bases:=array_append(bases,round(qty*price)-disc);
  taxable_before:=taxable_before+round(qty*price)-disc;
 end loop;
 if bill_discount<0 or bill_discount>taxable_before then raise exception 'Bill discount exceeds taxable value'; end if;
 if bill_discount>0 then
  -- Largest-remainder apportionment, tied by input order, matches the client preview.
  with fractions as (select ord, v*bill_discount/taxable_before exact from unnest(bases) with ordinality e(v,ord)),
  fractions_ranked as (select *, row_number() over(order by exact-trunc(exact) desc,ord) as rk, bill_discount-sum(trunc(exact)) over() as left_over from fractions)
  select array_agg(trunc(exact)+case when rk<=left_over then 1 else 0 end order by ord) into shares from fractions_ranked;
 end if;
 for ln in select * from jsonb_array_elements(d->'lines') loop
  line_count:=line_count+1;
  item:=tilebook.need_row(b,'products',ln->>'productId');
  tracked:=k not in ('estimates','proformas','purchaseOrders') or nullif(ln->>'lotId','') is not null;
  lot:=null;
  if tracked then
   lot:=tilebook.need_row(b,'lots',ln->>'lotId');
   if lot->>'productId'<>item->>'id' then raise exception 'The selected lot belongs to a different product'; end if;
  end if;
  qty:=(ln->>'qty')::numeric;
  units:=lower(coalesce(nullif(ln->>'unit',''),item->>'baseUnit','box'));
  if units not in ('box','piece','bag','sqft','slab','block','unit','pcs','service','set','kg','meter') then raise exception 'Unsupported unit %',units; end if;
  base_qty:=qty;
  if lower(item->>'baseUnit')='box' then
   if units in ('piece','pcs') then base_qty:=qty/greatest(1,(item->>'piecesPerBox')::numeric);
   elsif units='sqft' then base_qty:=ceil(qty/greatest(0.000001,(item->>'sqftPerPiece')::numeric))/greatest(1,(item->>'piecesPerBox')::numeric);
   elsif units<>'box' then raise exception 'Choose box, piece or sqft for tiles'; end if;
   boxes:=boxes+base_qty;
  elsif units<>lower(coalesce(item->>'baseUnit',units)) then raise exception 'Unit does not match this item'; end if;
  price:=coalesce(nullif(ln->>'rate','')::bigint,(item->>'salePrice')::bigint,0);
  disc:=coalesce(nullif(ln->>'discount','')::bigint,0);
  raw_amount:=round(qty*price)-disc;
  if bill_discount>0 then
   disc:=disc+shares[line_count];
  end if;
  taxable:=round(qty*price)-disc;
  gst:=coalesce(nullif(ln->>'gstRate','')::numeric,(item->>'gstRate')::numeric,18);
  if gst not between 0 and 100 or round(gst,2)<>gst then raise exception 'Invalid GST rate'; end if;
  tax:=round(taxable*gst/100);
  cgst:=case when intra then tax/2 else 0 end;
  sgst:=case when intra then tax-cgst else 0 end;
  igst:=case when intra then 0 else tax end;
  line_id:=gen_random_uuid()::text;
  source_line_id:=nullif(ln->>'sourceLineId',''); sl:=null;
  if src is not null then
   -- An explicit source line disambiguates repeated items and rooms.
   select x,ord::int-1 into sl,sidx from jsonb_array_elements(src->'lines') with ordinality e(x,ord)
   where (source_line_id is null or x->>'id'=source_line_id) and x->>'productId'=item->>'id'
   and (source_resource in ('estimates','proformas','purchaseOrders') or x->>'lotId'=lot->>'id')
   order by ord limit 1;
   if sl is null then raise exception 'Product and lot must match the original document'; end if;
   source_line_id:=sl->>'id';
   if is_return then
    already:=coalesce((sl->>'returnedBase')::numeric,0);
    if already+base_qty>(sl->>'baseQty')::numeric then raise exception 'Return exceeds original quantity'; end if;
    if units<>lower(sl->>'unit') then raise exception 'Return using the unit on the original line'; end if;
    -- Reverse the originally posted amounts, including the historical rate and
    -- allocated discounts. Cumulative rounding also handles fractional returns.
    original_boxes:=(sl->>'baseQty')::numeric;
    price:=(sl->>'rate')::bigint; gst:=(sl->>'gstRate')::numeric;
    taxable:=round((sl->>'taxable')::numeric*(already+base_qty)/original_boxes)-round((sl->>'taxable')::numeric*already/original_boxes);
    cgst:=round((sl->>'cgst')::numeric*(already+base_qty)/original_boxes)-round((sl->>'cgst')::numeric*already/original_boxes);
    sgst:=round((sl->>'sgst')::numeric*(already+base_qty)/original_boxes)-round((sl->>'sgst')::numeric*already/original_boxes);
    igst:=round((sl->>'igst')::numeric*(already+base_qty)/original_boxes)-round((sl->>'igst')::numeric*already/original_boxes);
    tax:=cgst+sgst+igst; disc:=greatest(0,round(qty*price)-taxable);
    item:=item||jsonb_build_object('hsn',sl->>'hsn');
    d:=d||jsonb_build_object('placeOfSupply',src->>'placeOfSupply');
    src:=jsonb_set(src,array['lines',sidx::text,'returnedBase'],to_jsonb(already+base_qty)); updated_source:=true;
   else
    already:=coalesce((sl->>'fulfilledBase')::numeric,0);
    if already+base_qty>(sl->>'baseQty')::numeric then raise exception 'Quantity exceeds outstanding balance'; end if;
    src:=jsonb_set(src,array['lines',sidx::text,'fulfilledBase'],to_jsonb(already+base_qty));
    src:=jsonb_set(src,array['lines',sidx::text,'delivered'],to_jsonb((already+base_qty)*(sl->>'qty')::numeric/(sl->>'baseQty')::numeric)); updated_source:=true;
   end if;
  end if;
  if k='challans' and selected_branch is distinct from src->>'branchId' then raise exception 'Dispatch from the reserved godown'; end if;
  if lot is not null then stock:=tilebook.stock(b,lot->>'id',selected_branch); end if;
  if k='saleOrders' or (k='debitNotes' and nullif(d->>'damageId','') is null) or (k='saleInvoices' and coalesce(source_resource,'')<>'challans') then
   if (stock->>'sellable')::numeric<base_qty and coalesce((prefs->>'stopNegativeStock')::boolean,true) then raise exception 'Insufficient sellable stock for % (lot %)',item->>'name',lot->>'lotNo'; end if;
  end if;
  if k='purchaseBills' then perform tilebook.move_stock(b,lot,selected_branch,i,k,base_qty);
  elsif k='saleOrders' then perform tilebook.move_stock(b,lot,selected_branch,i,k,0,base_qty);
  elsif k='challans' then perform tilebook.move_stock(b,lot,selected_branch,i,k,-base_qty,-base_qty);
  elsif k='creditNotes' then
   if ln->>'unopened'='false' then raise exception 'Only unopened stock can be returned'; end if;
   perform tilebook.move_stock(b,lot,selected_branch,i,k,base_qty);
  elsif (k='debitNotes' and nullif(d->>'damageId','') is null) or (k='saleInvoices' and coalesce(source_resource,'')<>'challans') then perform tilebook.move_stock(b,lot,selected_branch,i,k,-base_qty);
  end if;
  if k in ('saleInvoices','challans') then
   update public.lots set payload=payload||jsonb_build_object('lastSoldDate',greatest(coalesce((payload->>'lastSoldDate')::date,'1900-01-01'),(d->>'date')::date)),updated_at=now() where business_id=b and id=(lot->>'id')::uuid;
  end if;
  subtotal:=subtotal+taxable; taxsum:=taxsum+tax; csum:=csum+cgst; ssum:=ssum+sgst; isum:=isum+igst;
  ref:=jsonb_build_object('id',line_id,'sourceLineId',source_line_id,'productId',item->>'id','productName',item->>'name','lotId',lot->>'id','lotNo',lot->>'lotNo','shade',lot->>'shade','qty',qty,'baseQty',base_qty,'unit',units,'rate',price,'discount',disc,'gstRate',coalesce((item->>'gstRate')::numeric,18),'room',ln->>'room','sqft',case when lower(item->>'baseUnit')='box' then base_qty*coalesce((item->>'piecesPerBox')::numeric,1)*coalesce((item->>'sqftPerPiece')::numeric,0) else 0 end,'hsn',item->>'hsn','taxable',taxable,'tax',tax,'cgst',cgst,'sgst',sgst,'igst',igst,'amount',taxable+tax,'delivered',0);
  ref:=ref||jsonb_build_object('gstRate',gst);
  if k='purchaseBills' then ref:=ref||jsonb_build_object('landedCost',taxable+round(coalesce((d->>'freight')::numeric,(d->>'landedCost')::numeric,0)*taxable/greatest(taxable_before-bill_discount,1))); end if;
  result_lines:=result_lines||jsonb_build_array(ref);
 end loop;
 if updated_source then
  if not is_return then
   select exists(select 1 from jsonb_array_elements(src->'lines') x where coalesce((x->>'fulfilledBase')::numeric,0)<(x->>'baseQty')::numeric) into order_open;
   src:=src||jsonb_build_object('status',case when order_open then 'Partial' when source_resource='saleOrders' then 'Closed' else 'Converted' end);
  end if;
  perform tilebook.put(b,source_resource,(src->>'id')::uuid,src,true);
 end if;
 total:=round((subtotal+taxsum)::numeric/100)*100;
 paid:=coalesce(nullif(d->>'received','')::bigint,0);
 if paid<0 or paid>total or (k not in ('saleInvoices','purchaseBills','saleOrders') and paid<>0) then raise exception 'Invalid received amount'; end if;
 if k='saleInvoices' and coalesce((party->>'creditLimit')::bigint,0)>0 then
  select coalesce((party->>'openingBalance')::numeric,0)
   +coalesce((select sum((payload->>'total')::bigint) from public.sale_invoices where business_id=b and payload->>'partyId'=party->>'id'),0)
   -coalesce((select sum((payload->>'total')::bigint) from public.credit_notes where business_id=b and payload->>'partyId'=party->>'id'),0)
   -coalesce((select sum((payload->>'amount')::bigint) from public.payments where business_id=b and payload->>'partyId'=party->>'id' and payload->>'direction'='in'),0) into open_balance;
  if open_balance+total-paid>(party->>'creditLimit')::bigint then
   if coalesce((prefs->>'blockCreditLimit')::boolean,false) then raise exception 'Party credit limit exceeded'; end if;
   d:=d||jsonb_build_object('creditWarning',true);
  end if;
 end if;
 prefix:=case k when 'saleInvoices' then 'INV' when 'purchaseBills' then 'PB' when 'estimates' then 'Q' when 'proformas' then 'PI' when 'saleOrders' then 'SO' when 'challans' then 'DC' when 'creditNotes' then 'CN' when 'debitNotes' then 'DN' else 'PO' end;
 d:=d||jsonb_build_object('number',coalesce(nullif(d->>'number',''),tilebook.number_for(b,k,prefix)),'partyName',party->>'name','status',case when k in ('saleInvoices','purchaseBills') then case when paid=total then 'Paid' when paid>0 then 'Part paid' else 'Unpaid' end when k in ('challans','creditNotes','debitNotes') then 'Posted' else 'Open' end,'lines',result_lines,'taxable',subtotal,'tax',taxsum,'cgst',csum,'sgst',ssum,'igst',isum,'total',total,'roundOff',total-subtotal-taxsum,'received',paid,'balance',total-paid,'createdBy',user_id);
 if k='saleInvoices' and source_resource='challans' and src->>'sourceId' is not null then
  order_ref:=tilebook.need_row(b,'saleOrders',src->>'sourceId');
  advance:=least(total-paid,greatest(0,(order_ref->>'received')::bigint-coalesce((order_ref->>'advanceApplied')::bigint,0)));
  d:=d||jsonb_build_object('advanceApplied',advance,'received',paid+advance,'balance',total-paid-advance,'orderReference',order_ref->>'number','challanReference',src->>'number');
  if total=paid+advance then d:=d||'{"status":"Paid"}'::jsonb; end if;
  perform tilebook.put(b,'saleOrders',(order_ref->>'id')::uuid,order_ref||jsonb_build_object('advanceApplied',coalesce((order_ref->>'advanceApplied')::bigint,0)+advance),true);
 end if;
 if is_return then
  refund:=coalesce((src->>'credited')::bigint,0)+total;
  if refund>(src->>'total')::bigint then raise exception 'Credit exceeds original document value'; end if;
  src:=src||jsonb_build_object('credited',refund,'balance',greatest(0,(src->>'total')::bigint-refund-(src->>'received')::bigint));
  perform tilebook.put(b,source_resource,(src->>'id')::uuid,src,true);
 end if;
 d:=tilebook.put(b,k,i,d);
 if paid>0 then
  perform tilebook.put(b,'payments',gen_random_uuid(),jsonb_build_object('date',d->>'date','number',tilebook.number_for(b,'payments','R'),'partyId',party->>'id','partyName',party->>'name','documentId',i,'documentResource',k,'reference',d->>'number','direction',case when k='purchaseBills' then 'out' else 'in' end,'amount',paid,'mode',coalesce(nullif(d->>'paymentMode',''),'Cash'),'bankId',d->>'bankId','createdBy',user_id));
 end if;
 partner:=nullif(d->>'partnerId','');
 if partner is not null and k in ('saleInvoices','creditNotes') then
  perform tilebook.need_row(b,'parties',partner);
  select payload into rule from public.trade_partner_rules where business_id=b and payload->>'partyId'=partner;
  if k='creditNotes' then select payload->'rule' into rule from public.commissions where business_id=b and payload->>'documentId'=src->>'id' limit 1; end if;
  if rule is not null then
   payout:=round(case when rule->>'kind'='box' then boxes*(rule->>'rate')::numeric else subtotal*(rule->>'rate')::numeric/100 end)*(case when is_return then -1 else 1 end);
   perform tilebook.put(b,'commissions',gen_random_uuid(),jsonb_build_object('partnerId',partner,'documentId',i,'date',d->>'date','amount',payout,'rule',rule,'reference',d->>'number'));
  end if;
 end if;
 if k in ('saleInvoices','challans') and coalesce((prefs->>'whatsappEnabled')::boolean,false) then
 perform tilebook.put(b,'outbox',gen_random_uuid(),jsonb_build_object('kind',k,'documentId',i,'partyId',party->>'id','status','Queued')); end if;
 return d;
end $$;
do $uniques$
declare t text;
begin
 foreach t in array array['sale_invoices','estimates','proformas','sale_orders','delivery_challans','credit_notes','purchase_orders','purchase_bills','debit_notes','payments'] loop
 execute format('create unique index on public.%I (business_id,(payload->>''number''))',t);
 end loop;
end $uniques$;
revoke all on all functions in schema tilebook from public,anon,authenticated;

