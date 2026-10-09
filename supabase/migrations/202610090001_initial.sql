-- SilverFit: immutable production evidence, owner isolation and serialized safety gates.
create type public.product_kind as enum ('ramp','tip','holder');
create type public.app_status as enum ('submitted','measuring','designing','printing','safety_review','approved','delivered','evaluating','closed','rejected');
create table public.profiles(id uuid primary key references auth.users on delete cascade,name text not null check(length(name) between 1 and 60),role text not null check(role in ('self','guardian','social_worker')),created_at timestamptz not null default now());
-- Provision only via SQL/service role. Self-selected profile roles never grant staff privileges.
create table public.admin_users(user_id uuid primary key references auth.users on delete cascade);
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.admin_users where user_id=auth.uid()) $$;
create function public.handle_signup() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.profiles(id,name,role) values(new.id,left(coalesce(nullif(new.raw_user_meta_data->>'name',''),'참여자'),60),case when new.raw_user_meta_data->>'role' in ('guardian','social_worker') then new.raw_user_meta_data->>'role' else 'self' end);return new;end $$;
create trigger on_signup after insert on auth.users for each row execute function public.handle_signup();
create table public.applications(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users,
 product public.product_kind not null,applicant_role text not null check(applicant_role in ('self','guardian','social_worker')),
 beneficiary_name text not null check(length(beneficiary_name) between 1 and 60),contact text not null check(contact ~ '^[0-9+() -]{8,30}$'),
 environment text not null check(length(environment) between 2 and 1000),problem text not null check(length(problem) between 5 and 2000),
 measurements jsonb not null,consent_version text not null default '2026-10-09-v1',consented_at timestamptz not null default now(),
 status public.app_status not null default 'submitted',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.attachments(id uuid primary key default gen_random_uuid(),application_id uuid not null references public.applications,path text not null unique,original_name text not null check(length(original_name) between 1 and 200),created_at timestamptz not null default now(),check(split_part(path,'/',1)=application_id::text));
create table public.designs(id uuid primary key default gen_random_uuid(),application_id uuid not null references public.applications,version integer not null check(version>0),path text not null unique,parameters jsonb not null,parameter_schema_version text not null default 'mobility-v1-mm',generator text not null default 'manual',notes text not null,created_by uuid not null references auth.users,created_at timestamptz not null default now(),unique(application_id,version),check(split_part(path,'/',1)=application_id::text));
create table public.print_jobs(id uuid primary key default gen_random_uuid(),application_id uuid not null references public.applications,design_id uuid not null references public.designs,material text not null,printer text not null,duration_minutes integer not null check(duration_minutes>0),result text not null check(result in ('completed','failed')),notes text not null,created_by uuid not null references auth.users,created_at timestamptz not null default now());
create table public.safety_reviews(id uuid primary key default gen_random_uuid(),application_id uuid not null references public.applications,print_job_id uuid not null references public.print_jobs,decision text not null check(decision in ('passed','failed')),protocol text not null,evidence text not null,expert_name text not null,reviewed_by uuid not null references auth.users,sequence bigint generated always as identity,created_at timestamptz not null default now());
create table public.status_events(id bigint generated always as identity primary key,application_id uuid not null references public.applications,from_status public.app_status,to_status public.app_status not null,reason text not null,actor_id uuid not null references auth.users,created_at timestamptz not null default now());
create table public.feedback(id uuid primary key default gen_random_uuid(),application_id uuid not null references public.applications,author_id uuid not null references auth.users,rating integer not null check(rating between 1 and 5),comment text not null check(length(comment) between 5 and 2000),incident boolean not null default false,created_at timestamptz not null default now());
create index on public.applications(owner_id,created_at desc);
create index on public.applications(status,created_at desc);
create index on public.designs(application_id,version desc);
create index on public.print_jobs(application_id,created_at desc);
create index on public.safety_reviews(application_id,sequence desc);
create index on public.status_events(application_id,id);
create index on public.feedback(application_id);
create function public.can_access(app_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.applications where id=app_id and (owner_id=auth.uid() or public.is_admin())) $$;
create function public.owns_app(app_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.applications where id=app_id and owner_id=auth.uid()) $$;
create function public.validate_measurements(kind public.product_kind,m jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare keys text[]; k text; v numeric;
begin
 keys:=case kind when 'ramp' then array['height_mm','width_mm','depth_mm','available_length_mm'] when 'tip' then array['shaft_diameter_mm','contact_diameter_mm','insertion_depth_mm'] else array['shaft_diameter_mm','mounting_width_mm'] end;
 if jsonb_typeof(m)<>'object' or (select count(*) from jsonb_object_keys(m))<>cardinality(keys) then return false;end if;
 foreach k in array keys loop
 if not m ? k or jsonb_typeof(m->k)<>'number' then return false;end if;
 v:=(m->>k)::numeric;if v<=0 or v>10000 then return false;end if;
 end loop;return true;
exception when others then return false;end $$;
alter table public.applications add constraint valid_measurements check(public.validate_measurements(product,measurements));
create function public.create_application(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare app_id uuid;
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.';end if;
 if payload->'consent' is distinct from 'true'::jsonb then raise exception '참여 및 개인정보 처리 동의가 필요합니다.';end if;
 insert into public.applications(owner_id,product,applicant_role,beneficiary_name,contact,environment,problem,measurements)
 values(auth.uid(),(payload->>'product')::public.product_kind,payload->>'applicant_role',trim(payload->>'beneficiary_name'),trim(payload->>'contact'),trim(payload->>'environment'),trim(payload->>'problem'),payload->'measurements') returning id into app_id;
 insert into public.status_events(application_id,to_status,reason,actor_id) values(app_id,'submitted','신청을 접수했습니다.',auth.uid());return app_id;
end $$;
-- Returns the exact eligible print. Last review overrides earlier approvals. Locks on the
-- application serialize version creation, printing, review, incident reports and release.
create function public.approved_print(app_id uuid) returns uuid language sql stable security definer set search_path='' as $$
 select p.id from public.safety_reviews r join public.print_jobs p on p.id=r.print_job_id
 where r.id=(select id from public.safety_reviews where application_id=app_id order by sequence desc limit 1)
 and r.decision='passed' and p.result='completed' and p.design_id=(select id from public.designs where application_id=app_id order by version desc limit 1)
 and not exists(select 1 from public.feedback f where f.application_id=app_id and f.incident and f.created_at>=r.created_at)
 $$;
create function public.transition_application(app_id uuid,target text,reason text) returns void language plpgsql security definer set search_path='' as $$
declare a public.applications; expected text; t public.app_status;
begin
 if not public.is_admin() then raise exception '관리자 권한이 필요합니다.';end if;
 select * into a from public.applications where id=app_id for update;if not found then raise exception '신청을 찾을 수 없습니다.';end if;
 if length(trim(reason))<3 or length(reason)>2000 then raise exception '변경 사유를 3~2000자로 입력해 주세요.';end if;
 t:=target::public.app_status;
 expected:=case a.status when 'submitted' then 'measuring' when 'measuring' then 'designing' when 'designing' then 'printing' when 'printing' then 'safety_review' when 'safety_review' then 'approved' when 'approved' then 'delivered' when 'delivered' then 'evaluating' when 'evaluating' then 'closed' else null end;
 if target is distinct from expected and not (target='rejected' and a.status in ('submitted','measuring','designing','printing','safety_review','approved')) then raise exception '허용되지 않는 상태 변경입니다.';end if;
 if t in ('printing','safety_review','approved','delivered','evaluating','closed') and not exists(select 1 from public.designs where application_id=app_id) then raise exception '설계 파일을 먼저 등록해 주세요.';end if;
 if t='safety_review' and not exists(select 1 from public.print_jobs where application_id=app_id and result='completed' and design_id=(select id from public.designs where application_id=app_id order by version desc limit 1)) then raise exception '현재 설계의 완료된 출력물 기록이 필요합니다.';end if;
 if t in ('approved','delivered','evaluating','closed') and public.approved_print(app_id) is null then raise exception '현재 설계·출력물의 안전성 통과 기록이 필요합니다. 사고 신고 여부도 확인해 주세요.';end if;
 update public.applications set status=t,updated_at=now() where id=app_id;
 insert into public.status_events(application_id,from_status,to_status,reason,actor_id) values(app_id,a.status,t,reason,auth.uid());
end $$;
create function public.add_design(app_id uuid,file_path text,notes text) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.applications; result_id uuid; n integer;
begin
 if not public.is_admin() then raise exception '관리자 권한이 필요합니다.';end if;
 select * into a from public.applications where id=app_id for update;if not found then raise exception '신청을 찾을 수 없습니다.';end if;
 if a.status not in ('designing','printing','safety_review','approved') then raise exception '설계 검토 단계에서 등록해 주세요. 전달 후에는 새 신청으로 개선품을 제작해 주세요.';end if;
 if length(trim(notes))<5 or length(notes)>2000 then raise exception '설계 변경 내용을 입력해 주세요.';end if;
 if not exists(select 1 from storage.objects where bucket_id='design-files' and name=file_path) then raise exception '업로드된 설계 파일이 없습니다.';end if;
 select coalesce(max(version),0)+1 into n from public.designs where application_id=app_id;
 insert into public.designs(application_id,version,path,parameters,notes,created_by) values(app_id,n,file_path,a.measurements,notes,auth.uid()) returning id into result_id;
 if a.status<>'designing' then
 update public.applications set status='designing',updated_at=now() where id=app_id;
 insert into public.status_events(application_id,from_status,to_status,reason,actor_id) values(app_id,a.status,'designing','새 설계 버전 등록: 출력·안전성 재검토 필요',auth.uid());end if;return result_id;
end $$;
create function public.add_print_job(app_id uuid,payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.applications; result_id uuid; d uuid;
begin
 if not public.is_admin() then raise exception '관리자 권한이 필요합니다.';end if;
 select * into a from public.applications where id=app_id for update;
 if not found or a.status<>'printing' then raise exception '시험 제작 단계에서 출력물을 등록해 주세요.';end if;
 d:=(payload->>'design_id')::uuid;
 if d is distinct from (select id from public.designs where application_id=app_id order by version desc limit 1) then raise exception '현재 설계 버전에만 출력물을 등록할 수 있습니다.';end if;
 if length(trim(payload->>'material')) not between 2 and 100 or length(trim(payload->>'printer')) not between 2 and 100 or length(trim(payload->>'notes')) not between 5 and 2000 or (payload->>'duration_minutes')::integer not between 1 and 100000 then raise exception '출력 조건과 결과를 확인해 주세요.';end if;
 insert into public.print_jobs(application_id,design_id,material,printer,duration_minutes,result,notes,created_by) values(app_id,d,payload->>'material',payload->>'printer',(payload->>'duration_minutes')::integer,payload->>'result',payload->>'notes',auth.uid()) returning id into result_id;return result_id;
end $$;
create function public.add_safety_review(app_id uuid,payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.applications; p public.print_jobs; result_id uuid;
begin
 if not public.is_admin() then raise exception '관리자 권한이 필요합니다.';end if;
 select * into a from public.applications where id=app_id for update;
 if not found or a.status not in ('safety_review','approved','delivered','evaluating','closed') then raise exception '안전성 검토 단계부터 기록할 수 있습니다.';end if;
 select * into p from public.print_jobs where id=(payload->>'print_job_id')::uuid and application_id=app_id;
 if not found or p.result<>'completed' or p.design_id is distinct from (select id from public.designs where application_id=app_id order by version desc limit 1) then raise exception '현재 설계의 완료된 출력물을 선택해 주세요.';end if;
 if length(trim(payload->>'protocol')) not between 5 and 2000 or length(trim(payload->>'evidence')) not between 10 and 4000 or length(trim(payload->>'expert_name')) not between 2 and 100 then raise exception '시험 방법·결과·검토 전문가를 기록해 주세요.';end if;
 insert into public.safety_reviews(application_id,print_job_id,decision,protocol,evidence,expert_name,reviewed_by) values(app_id,p.id,payload->>'decision',payload->>'protocol',payload->>'evidence',payload->>'expert_name',auth.uid()) returning id into result_id;
 if payload->>'decision'='failed' and a.status<>'safety_review' then
 update public.applications set status='safety_review',updated_at=now() where id=app_id;
 insert into public.status_events(application_id,from_status,to_status,reason,actor_id) values(app_id,a.status,'safety_review','안전성 부적합: 사용 승인 철회, 사용 중단·회수 연락 필요',auth.uid());end if;return result_id;
end $$;
create function public.add_feedback(app_id uuid,score integer,body text,incident boolean) returns void language plpgsql security definer set search_path='' as $$
declare a public.applications;
begin
 select * into a from public.applications where id=app_id for update;
 if not found or a.owner_id<>auth.uid() or auth.uid() is null then raise exception '본인 신청에만 의견을 남길 수 있습니다.';end if;
 if a.status not in ('delivered','evaluating','closed') then raise exception '전달 완료 후 의견을 남길 수 있습니다.';end if;
 insert into public.feedback(application_id,author_id,rating,comment,incident) values(app_id,auth.uid(),score,body,incident);
 if incident then
 update public.applications set status='safety_review',updated_at=now() where id=app_id;
 insert into public.status_events(application_id,from_status,to_status,reason,actor_id) values(app_id,a.status,'safety_review','사용 중 문제 신고: 사용 중단 및 안전성 재검토',auth.uid());end if;
end $$;
-- Every public table uses RLS. Immutable child records are writable only via RPC.
alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.applications enable row level security;
alter table public.attachments enable row level security;
alter table public.designs enable row level security;
alter table public.print_jobs enable row level security;
alter table public.safety_reviews enable row level security;
alter table public.status_events enable row level security;
alter table public.feedback enable row level security;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
create policy applications_read on public.applications for select to authenticated using(owner_id=auth.uid() or public.is_admin());
create policy attachments_read on public.attachments for select to authenticated using(public.can_access(application_id));
create policy attachments_insert on public.attachments for insert to authenticated with check(public.can_access(application_id) and exists(select 1 from storage.objects o where o.bucket_id='application-photos' and o.name=path));
create policy designs_read on public.designs for select to authenticated using(public.can_access(application_id));
create policy prints_read on public.print_jobs for select to authenticated using(public.can_access(application_id));
create policy reviews_read on public.safety_reviews for select to authenticated using(public.can_access(application_id));
create policy events_read on public.status_events for select to authenticated using(public.can_access(application_id));
create policy feedback_read on public.feedback for select to authenticated using(public.can_access(application_id));
revoke all on all tables in schema public from anon,authenticated;
grant select on public.profiles,public.applications,public.attachments,public.designs,public.print_jobs,public.safety_reviews,public.status_events,public.feedback to authenticated;
grant insert on public.attachments to authenticated;
-- PostgreSQL grants function EXECUTE to PUBLIC by default: explicitly remove it.
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.is_admin(),public.can_access(uuid),public.owns_app(uuid),public.create_application(jsonb),public.transition_application(uuid,text,text),public.add_design(uuid,text,text),public.add_print_job(uuid,jsonb),public.add_safety_review(uuid,jsonb),public.add_feedback(uuid,integer,text,boolean) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('application-photos','application-photos',false,10485760,array['image/jpeg','image/png','image/webp']),
 ('design-files','design-files',false,20971520,array['application/octet-stream']);
-- Filename is app UUID/random UUID.ext; no overwrites/deletion, including by admins.
create policy photo_read on storage.objects for select to authenticated using(bucket_id='application-photos' and public.can_access((storage.foldername(name))[1]::uuid));
create policy photo_upload on storage.objects for insert to authenticated with check(bucket_id='application-photos' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpeg|png|webp)$' and public.can_access((storage.foldername(name))[1]::uuid));
create policy design_read on storage.objects for select to authenticated using(bucket_id='design-files' and public.can_access((storage.foldername(name))[1]::uuid));
create policy design_upload on storage.objects for insert to authenticated with check(bucket_id='design-files' and public.is_admin() and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(stl|step|stp|3mf|scad)$' and public.can_access((storage.foldername(name))[1]::uuid));
