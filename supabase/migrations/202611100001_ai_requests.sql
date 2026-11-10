-- AI outputs are advisory only: never inputs to approved_print or safety approval.
create table public.ai_analysis_requests (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users on delete cascade,
 created_at timestamptz not null default now()
);
create index on public.ai_analysis_requests(owner_id,created_at);
alter table public.ai_analysis_requests enable row level security;
revoke all on public.ai_analysis_requests from public,anon,authenticated;
create function public.reserve_ai_analysis() returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if (select count(*) from public.ai_analysis_requests where owner_id=auth.uid() and created_at>now()-interval '1 hour')>=3 then
 raise exception 'AI 분석은 시간당 3회까지 가능합니다. 잠시 후 다시 시도해 주세요.';end if;
 insert into public.ai_analysis_requests(owner_id) values(auth.uid()) returning id into result;
 return result;end $$;
revoke all on function public.reserve_ai_analysis() from public,anon;
grant execute on function public.reserve_ai_analysis() to authenticated;
-- Periodically remove rate-limit metadata older than 7 days from the dashboard/service role.
