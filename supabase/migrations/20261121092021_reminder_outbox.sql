-- Materialize messages for a provider to deliver. No SMS/WhatsApp provider
-- is called by database triggers or by the scheduled job.
create unique index message_event_channel on public.message_outbox
 (business_id,(payload->>'eventKey'),(payload->>'channel')) where payload ? 'eventKey';
create unique index reminder_event on public.reminders
 (business_id,(payload->>'eventKey')) where payload ? 'eventKey';

create function tilebook.message_text(k text, lang text, shop text, ref text, amount bigint, due text) returns text
language sql immutable set search_path='' as $$
select case k
 when 'saleInvoices' then format(case lang when 'hi' then '%s से बिल %s, कुल ₹%s।' when 'or' then '%s ର ବିଲ୍ %s, ମୋଟ ₹%s।' else '%s issued invoice %s for ₹%s.' end,shop,ref,to_char(amount/100.0,'FM9999999999990.00'))
 when 'challans' then format(case lang when 'hi' then '%s से आपकी सामग्री भेजी गई है। चालान %s।' when 'or' then '%s ରୁ ଆପଣଙ୍କ ସାମଗ୍ରୀ ପଠାଯାଇଛି। ଚାଲାଣ %s।' else '%s has dispatched your material under challan %s.' end,shop,ref)
 when 'paymentReminder' then format(case lang when 'hi' then '%s के बिल %s में ₹%s बाकी हैं। भुगतान की तारीख %s।' when 'or' then '%s ର ବିଲ୍ %s ରେ ₹%s ବାକି ଅଛି। ଦେୟ ତାରିଖ %s।' else '%s invoice %s has ₹%s outstanding. Payment is due on %s.' end,shop,ref,to_char(amount/100.0,'FM9999999999990.00'),due)
 when 'inactivePartner' then format(case lang when 'hi' then '%s से नमस्ते। आपकी अगली साइट के लिए कोटेशन या सैंपल चाहिए तो हमें बताएं।' when 'or' then '%s ରୁ ନମସ୍କାର। ଆଗାମୀ କାମ ପାଇଁ କୋଟେସନ୍ ବା ସାମ୍ପଲ୍ ଦରକାର ହେଲେ ଜଣାନ୍ତୁ।' else 'Hello from %s. Please let us know if your next site needs a quotation or tile samples.' end,shop)
 when 'dailySummary' then format(case lang when 'hi' then '%s · %s · बिक्री ₹%s · प्राप्त ₹%s।' when 'or' then '%s · %s · ବିକ୍ରି ₹%s · ପ୍ରାପ୍ତି ₹%s।' else '%s · %s · Sales ₹%s · Money received ₹%s.' end,shop,ref,to_char(amount/100.0,'FM9999999999990.00'),due)
end
$$;

create function tilebook.enqueue_channels(b uuid,prefs jsonb,event jsonb,target text,scheduled timestamptz) returns integer
language plpgsql set search_path='' as $$
declare ch text; phone text:=regexp_replace(coalesce(target,''),'[^0-9]','','g'); n integer:=0; inserted integer; prepared jsonb;
begin
 if length(phone)=10 then phone:='91'||phone; end if;
 if phone!~'^[1-9][0-9]{10,14}$' then return 0; end if;
 foreach ch in array array['whatsapp','sms'] loop
  if prefs->>(ch||'Enabled') is distinct from 'true' then continue; end if;
  prepared:=event||jsonb_build_object('channel',ch,'recipient','+'||phone,'scheduledFor',scheduled,'status','Queued');
  insert into public.message_outbox(business_id,payload) values(b,prepared)
   on conflict(business_id,(payload->>'eventKey'),(payload->>'channel')) where payload ? 'eventKey' do nothing;
  get diagnostics inserted=row_count;
  n:=n+inserted;
  -- A partial payment or phone correction changes an unsent message's contents.
  if inserted=0 then
   update public.message_outbox set payload=prepared,updated_at=now() where business_id=b
    and payload->>'eventKey'=event->>'eventKey' and payload->>'channel'=ch and payload->>'status'='Queued' and payload is distinct from prepared;
  end if;
 end loop;
 return n;
end $$;

create function tilebook.note_reminder(b uuid,event jsonb) returns integer language plpgsql set search_path='' as $$
declare inserted integer;
begin
 insert into public.reminders(business_id,payload) values(b,event||jsonb_build_object('status','Pending'))
 on conflict(business_id,(payload->>'eventKey')) where payload ? 'eventKey' do nothing;
 get diagnostics inserted=row_count;
 return inserted;
end $$;

create function tilebook.queue_document() returns trigger language plpgsql set search_path='' as $$
declare kind text:=tg_argv[0]; b uuid:=new.business_id; d jsonb:=new.payload; prefs jsonb; party jsonb; shop text; evt jsonb;
begin
 select payload->'value' into prefs from public.settings where business_id=b and payload->>'key'='preferences';
 if not(coalesce(prefs->>'whatsappEnabled','false')='true' or coalesce(prefs->>'smsEnabled','false')='true') then return new; end if;
 if (kind='saleInvoices' and prefs->>'invoiceMessage'='false') or (kind='challans' and prefs->>'confirmDelivery'='false') then return new; end if;
 select name into shop from public.businesses where id=b;
 party:=tilebook.need_row(b,'parties',d->>'partyId');
 evt:=jsonb_build_object('eventKey',kind||':'||new.id,'kind',kind,'reference',d->>'number','documentId',new.id,'partyId',d->>'partyId','message',tilebook.message_text(kind,prefs->>'language',shop,d->>'number',(d->>'total')::bigint,null));
 if kind='saleInvoices' then evt:=evt||jsonb_build_object('attachment',jsonb_build_object('kind','invoicePdf','documentId',new.id)); end if;
 perform tilebook.enqueue_channels(b,prefs,evt,party->>'phone',now());
 return new;
end $$;
-- Restores insert archived rows, which must not trigger new messages. Normal
-- document issuance writes the old-style notification after inserting its sale.
create function tilebook.ignore_old_notification() returns trigger language plpgsql set search_path='' as $$
begin
 if new.payload->>'kind' in ('saleInvoices','challans') and not(new.payload ? 'eventKey') then return null; end if;
 return new;
end $$;
create trigger standard_message_rows before insert on public.message_outbox for each row execute function tilebook.ignore_old_notification();
create trigger prepare_invoice_message after insert on public.sale_invoices for each row when (new.created_at=transaction_timestamp()) execute function tilebook.queue_document('saleInvoices');
create trigger prepare_delivery_message after insert on public.delivery_challans for each row when (new.created_at=transaction_timestamp()) execute function tilebook.queue_document('challans');

create function tilebook.prepare_messages(b uuid,clock_time timestamptz default now()) returns jsonb
language plpgsql set search_path='' as $$
declare prefs jsonb; local_now timestamp:=clock_time at time zone 'Asia/Kolkata'; local_day date:=local_now::date;
 lead_days int; inactive_days int; cutoff time; k text; r record; evt jsonb; scheduled timestamptz; shop text; owner_phone text;
 sales bigint; receipts bigint; queued integer:=0; reminders integer:=0; amount bigint; due_day date; last_contact date;
begin
 perform pg_advisory_xact_lock(hashtext(b::text));
 select payload->'value' into prefs from public.settings where business_id=b and payload->>'key'='preferences';
 select name into shop from public.businesses where id=b;
 -- Never leave a settled invoice in the outgoing collection queue.
 update public.message_outbox q set payload=q.payload||'{"status":"Cancelled"}'::jsonb,updated_at=now()
 where q.business_id=b and q.payload->>'status'='Queued' and
 (coalesce(prefs->>((q.payload->>'channel')||'Enabled'),'false')<>'true' or
 (q.payload->>'kind'='paymentReminder' and (prefs->>'paymentReminders'='false' or not exists(select from public.sale_invoices s where s.business_id=b and s.id::text=q.payload->>'documentId' and (s.payload->>'balance')::bigint>0))));
 update public.reminders q set payload=q.payload||'{"status":"Closed"}'::jsonb,updated_at=now()
 where q.business_id=b and q.payload->>'kind'='paymentReminder' and q.payload->>'status'='Pending' and not exists(
 select from public.sale_invoices s where s.business_id=b and s.id::text=q.payload->>'documentId' and (s.payload->>'balance')::bigint>0);
 if not(coalesce(prefs->>'whatsappEnabled','false')='true' or coalesce(prefs->>'smsEnabled','false')='true') then return jsonb_build_object('queued',0,'reminders',0); end if;
 lead_days:=case when prefs->>'dueDays'~'^[0-9]{1,3}$' then least(90,(prefs->>'dueDays')::int) else 3 end;
 inactive_days:=case when prefs->>'inactivePartnerDays'~'^[0-9]{1,3}$' then greatest(1,(prefs->>'inactivePartnerDays')::int) else 60 end;
 cutoff:=case when prefs->>'ownerSummaryTime'~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then (prefs->>'ownerSummaryTime')::time else time '21:00' end;
 if coalesce(prefs->>'paymentReminders','true')='true' then
  for r in select s.id,s.payload,p.payload as buyer from public.sale_invoices s join public.parties p on p.business_id=s.business_id and p.id::text=s.payload->>'partyId'
   where s.business_id=b and (s.payload->>'balance')::bigint>0 and nullif(s.payload->>'dueDate','')::date<=local_day+lead_days loop
   due_day:=(r.payload->>'dueDate')::date; amount:=(r.payload->>'balance')::bigint;
   evt:=jsonb_build_object('eventKey','payment:'||r.id||':'||due_day,'kind','paymentReminder','reference',r.payload->>'number','documentId',r.id,'partyId',r.payload->>'partyId','date',due_day,'amount',amount,'message',tilebook.message_text('paymentReminder',prefs->>'language',shop,r.payload->>'number',amount,to_char(due_day,'DD/MM/YYYY')));
   scheduled:=((due_day-lead_days)+time '09:00') at time zone 'Asia/Kolkata';
   reminders:=reminders+tilebook.note_reminder(b,evt); queued:=queued+tilebook.enqueue_channels(b,prefs,evt,r.buyer->>'phone',scheduled);
  end loop;
 end if;
 if prefs->>'inactivePartnerReminders'='true' and tilebook.entitlements(b)->>'premium'='true' then
  for r in select t.id,t.payload,p.payload as buyer,greatest(coalesce(nullif(t.payload->>'lastContact','')::date,t.created_at::date),coalesce((select max((s.payload->>'date')::date) from public.sale_invoices s where s.business_id=b and s.payload->>'partnerId'=p.id::text),'1900-01-01')) as last_day from public.trade_partner_rules t join public.parties p on p.business_id=t.business_id and p.id::text=t.payload->>'partyId' where t.business_id=b loop
   last_contact:=r.last_day;
   if last_contact+inactive_days>local_day then continue; end if;
   evt:=jsonb_build_object('eventKey','partner:'||r.id||':'||last_contact,'kind','inactivePartner','reference',r.buyer->>'name','partyId',r.payload->>'partyId','date',last_contact+inactive_days,'message',tilebook.message_text('inactivePartner',prefs->>'language',shop,null,null,null));
   reminders:=reminders+tilebook.note_reminder(b,evt);
   queued:=queued+tilebook.enqueue_channels(b,prefs,evt,r.buyer->>'phone',((last_contact+inactive_days)+time '09:00') at time zone 'Asia/Kolkata');
  end loop;
 end if;
 if prefs->>'dailyOwnerSummary'='true' and local_now::time>=cutoff then
  select u.phone into owner_phone from public.memberships m join auth.users u on u.id=m.user_id where m.business_id=b and m.role='Owner' and u.phone_confirmed_at is not null order by m.created_at,m.id limit 1;
  select coalesce(sum((payload->>'total')::bigint),0) into sales from public.sale_invoices where business_id=b and (payload->>'date')::date=local_day;
  select coalesce(sum((payload->>'amount')::bigint),0) into receipts from public.payments where business_id=b and payload->>'direction'='in' and (payload->>'date')::date=local_day;
  evt:=jsonb_build_object('eventKey','summary:'||local_day,'kind','dailySummary','reference',to_char(local_day,'DD/MM/YYYY'),'date',local_day,'sales',sales,'received',receipts,'message',tilebook.message_text('dailySummary',prefs->>'language',shop,to_char(local_day,'DD/MM/YYYY'),sales,to_char(receipts/100.0,'FM9999999999990.00')));
  queued:=queued+tilebook.enqueue_channels(b,prefs,evt,owner_phone,(local_day+cutoff) at time zone 'Asia/Kolkata');
 end if;
 return jsonb_build_object('queued',queued,'reminders',reminders);
end $$;

create function public.tilebook_prepare_messages(p_business_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare b uuid:=tilebook.default_business(p_business_id);
begin
 if tilebook.my_role(b) not in ('Owner','Manager') then raise exception 'Role cannot prepare messages' using errcode='42501'; end if;
 return tilebook.prepare_messages(b);
end $$;
create function tilebook.prepare_scheduled_messages() returns void language plpgsql set search_path='' as $$
declare firm uuid;
begin
 for firm in select business_id from public.settings where payload->>'key'='preferences' and (payload#>>'{value,whatsappEnabled}'='true' or payload#>>'{value,smsEnabled}'='true') order by business_id loop
  if pg_try_advisory_xact_lock(hashtext(firm::text)) then perform tilebook.prepare_messages(firm); end if;
 end loop;
end $$;
-- When pg_cron is enabled after deployment, a database administrator may
-- install this same named job. The name makes installation repeatable.
create function tilebook.install_reminder_schedule() returns void language plpgsql set search_path='' as $$
begin
 if to_regprocedure('cron.schedule(text,text,text)') is not null then
  execute 'select cron.schedule($1,$2,$3)' using 'tilebook-message-preparation','*/15 * * * *','select tilebook.prepare_scheduled_messages()';
 end if;
end $$;
select tilebook.install_reminder_schedule();
revoke all on all functions in schema tilebook from public,anon,authenticated;
revoke all on function public.tilebook_prepare_messages(uuid) from public,anon;
grant execute on function public.tilebook_prepare_messages(uuid) to authenticated;

