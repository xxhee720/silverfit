-- User initiates deletion inside the app; operator verifies retention obligations,
-- deletes private storage objects + related rows, and removes the Auth account.
create table public.account_deletion_requests (
 user_id uuid primary key references auth.users on delete cascade,
 requested_at timestamptz not null default now()
);
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public,anon,authenticated;
grant select on public.account_deletion_requests to authenticated;
create policy deletion_requests_read on public.account_deletion_requests for select to authenticated using(user_id=auth.uid() or public.is_admin());
create function public.request_account_deletion() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.';end if;
 insert into public.account_deletion_requests(user_id) values(auth.uid()) on conflict do nothing;
end $$;
revoke all on function public.request_account_deletion() from public,anon;
grant execute on function public.request_account_deletion() to authenticated;
