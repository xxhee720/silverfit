-- Immutable photo-calculation provenance. Existing owner/admin RLS also protects this column.
alter table public.applications add column measurement_evidence jsonb not null default '[]'::jsonb;
create function public.validate_photo_evidence(m jsonb, evidence jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare e jsonb; k text; seen text[] := '{}'; w numeric; h numeric; ref numeric; target numeric; estimated numeric; i integer; x numeric; y numeric;
begin
 if jsonb_typeof(evidence)<>'array' or jsonb_array_length(evidence)>4 then return false; end if;
 for e in select value from jsonb_array_elements(evidence) loop
  k:=e->>'field';
  if k is null or not m ? k or k=any(seen) or e->>'method' is distinct from 'photo-reference-v1' then return false;end if;
  seen:=array_append(seen,k);
  if jsonb_typeof(e->'reference_mm') is distinct from 'number' or jsonb_typeof(e->'estimated_mm') is distinct from 'number' or jsonb_typeof(e->'image_width') is distinct from 'number' or jsonb_typeof(e->'image_height') is distinct from 'number' then return false;end if;
  w:=(e->>'image_width')::numeric;h:=(e->>'image_height')::numeric;
  if w<1 or h<1 or w>10000 or h>10000 or w<>trunc(w) or h<>trunc(h) or (e->>'reference_mm')::numeric<=0 or (e->>'reference_mm')::numeric>10000 then return false;end if;
  if jsonb_typeof(e->'points') is distinct from 'array' or jsonb_array_length(e->'points')<>4 then return false;end if;
  for i in 0..3 loop
   if jsonb_typeof(e->'points'->i->'x') is distinct from 'number' or jsonb_typeof(e->'points'->i->'y') is distinct from 'number' then return false;end if;
   x:=(e->'points'->i->>'x')::numeric;y:=(e->'points'->i->>'y')::numeric;
   if x<0 or x>1 or y<0 or y>1 then return false;end if;
  end loop;
  ref:=sqrt(power(((e->'points'->0->>'x')::numeric-(e->'points'->1->>'x')::numeric)*w,2)+power(((e->'points'->0->>'y')::numeric-(e->'points'->1->>'y')::numeric)*h,2));
  target:=sqrt(power(((e->'points'->2->>'x')::numeric-(e->'points'->3->>'x')::numeric)*w,2)+power(((e->'points'->2->>'y')::numeric-(e->'points'->3->>'y')::numeric)*h,2));
  if ref<20 or target<5 then return false;end if;
  estimated:=(e->>'estimated_mm')::numeric;
  if abs(target/ref*(e->>'reference_mm')::numeric-estimated)>0.051 or estimated<>(m->>k)::numeric then return false;end if;
 end loop;
 return true;
exception when others then return false;end $$;
alter table public.applications add constraint valid_photo_evidence check(public.validate_photo_evidence(measurements,measurement_evidence));
alter function public.create_application(jsonb) rename to create_application_v1;
revoke execute on function public.create_application_v1(jsonb) from public,anon,authenticated;
create function public.create_application(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; evidence jsonb:=coalesce(payload->'measurement_evidence','[]'::jsonb);
begin
 if not public.validate_photo_evidence(payload->'measurements',evidence) then raise exception '사진 측정 데이터를 확인해 주세요.';end if;
 result:=public.create_application_v1(payload);
 update public.applications set measurement_evidence=evidence where id=result;
 return result;
end $$;
revoke execute on function public.validate_photo_evidence(jsonb,jsonb),public.create_application(jsonb) from public,anon,authenticated;
grant execute on function public.create_application(jsonb) to authenticated;
