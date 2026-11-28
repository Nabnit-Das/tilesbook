-- Update only the invitation branch of the existing audited mutation routine.
do $migration$
declare
  existing text := pg_get_functiondef('tilebook.tilebook_mutate(uuid,text,text,jsonb,uuid)'::regprocedure);
  previous text := $old$ counterparty:=regexp_replace(coalesce(p->>'phone',''),'[^0-9]','','g');
 if length(counterparty)=10 then counterparty:='91'||counterparty; end if;
 if counterparty!~'^[1-9][0-9]{10,14}$' then raise exception 'Invalid phone number'; end if;
 p:=(p-'userId')||jsonb_build_object('phone',counterparty,'status',coalesce(before_row->>'status','Invited'),'userId',before_row->>'userId');
$old$;
  revised text := $new$ if nullif(btrim(p->>'email'),'') is not null then
   counterparty:=lower(btrim(p->>'email'));
   if length(counterparty)>254 or counterparty!~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Invalid invitation email'; end if;
   if before_row->>'status'='Active' and nullif(before_row->>'email','') is not null and lower(before_row->>'email')<>counterparty then raise exception 'Revoke the existing membership before changing its email'; end if;
   p:=(p-'userId')||jsonb_build_object('email',counterparty,'status',coalesce(before_row->>'status','Invited'),'userId',before_row->>'userId');
 else
 counterparty:=regexp_replace(coalesce(p->>'phone',''),'[^0-9]','','g');
 if length(counterparty)=10 then counterparty:='91'||counterparty; end if;
 if counterparty!~'^[1-9][0-9]{10,14}$' then raise exception 'Invalid phone number'; end if;
 p:=(p-'userId')||jsonb_build_object('phone',counterparty,'status',coalesce(before_row->>'status','Invited'),'userId',before_row->>'userId');
 end if;
$new$;
begin
  existing:=replace(existing,chr(13),'');
  previous:=replace(previous,chr(13),'');
  if strpos(existing,previous)=0 then raise exception 'Unexpected invitation routine version'; end if;
  execute replace(existing,previous,revised);
end $migration$;
