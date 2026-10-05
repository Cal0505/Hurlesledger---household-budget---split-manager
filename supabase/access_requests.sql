alter table public.household_members
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists household_members_auth_user_id_unique
  on public.household_members (auth_user_id)
  where auth_user_id is not null;

create or replace function public.revoke_linked_member_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.auth_user_id is not null then
    delete from public.household_access
    where user_id = old.auth_user_id;
  end if;
  return old;
end;
$$;

drop trigger if exists household_member_revoke_access on public.household_members;
create trigger household_member_revoke_access
  before delete on public.household_members
  for each row execute function public.revoke_linked_member_access();

create table if not exists public.household_access_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  member_id text not null references public.household_members(id) on delete cascade,
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now()
);

create unique index if not exists household_access_requests_pending_member_unique
  on public.household_access_requests (member_id)
  where status = 'pending';

alter table public.household_access_requests enable row level security;
revoke all on public.household_access_requests from anon, authenticated;
grant select on public.household_access_requests to authenticated;

drop policy if exists "Requesters and household users can read access requests" on public.household_access_requests;
drop policy if exists "Requesters and account holders can read access requests" on public.household_access_requests;
create policy "Requesters and account holders can read access requests"
  on public.household_access_requests for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_household_account_holder())
  );

create or replace function public.list_unlinked_household_members()
returns table (id text, name text)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_household_account_holder() then
    raise exception 'Only an account holder can view unlinked household members.';
  end if;

  return query
    select member.id, member.name
    from public.household_members member
    where member.auth_user_id is null
    order by member.name;
end;
$$;

revoke all on function public.list_unlinked_household_members() from public, anon;
grant execute on function public.list_unlinked_household_members() to authenticated;

create or replace function public.request_household_access(requested_member_id text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  requester_email text;
  email_verified timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Sign in with the requested email before requesting access.';
  end if;

  select users.email, users.email_confirmed_at
    into requester_email, email_verified
    from auth.users users
    where users.id = auth.uid();

  if requester_email is null or email_verified is null then
    raise exception 'Verify your email address before requesting household access.';
  end if;

  if exists (
    select 1 from public.household_access access
    where access.user_id = auth.uid()
  ) then
    raise exception 'This account already has household access.';
  end if;

  if not exists (
    select 1 from public.household_members member
    where member.id = requested_member_id
      and member.auth_user_id is null
  ) then
    raise exception 'That household member is already linked or no longer available.';
  end if;

  insert into public.household_access_requests (user_id, member_id, email, status, created_at)
  values (auth.uid(), requested_member_id, lower(requester_email), 'pending', now())
  on conflict (user_id) do update
    set member_id = excluded.member_id,
        email = excluded.email,
        status = 'pending',
        created_at = now();
end;
$$;

revoke all on function public.request_household_access(text) from public, anon;
grant execute on function public.request_household_access(text) to authenticated;

create or replace function public.resolve_household_access_request(
  requested_user_id uuid,
  approve_request boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  request_row public.household_access_requests%rowtype;
begin
  if not public.is_household_account_holder() then
    raise exception 'Only an account holder can review access requests.';
  end if;

  select * into request_row
    from public.household_access_requests
    where user_id = requested_user_id
      and status = 'pending'
    for update;

  if not found then
    raise exception 'This access request is no longer pending.';
  end if;

  if approve_request then
    update public.household_members
      set auth_user_id = request_row.user_id,
          email = request_row.email
      where id = request_row.member_id
        and auth_user_id is null;

    if not found then
      raise exception 'This household member has already been linked to another account.';
    end if;

    insert into public.household_access (user_id)
    values (request_row.user_id)
    on conflict (user_id) do nothing;

    update public.household_access_requests
      set status = 'approved'
      where user_id = requested_user_id;
  else
    update public.household_access_requests
      set status = 'denied'
      where user_id = requested_user_id;
  end if;
end;
$$;

revoke all on function public.resolve_household_access_request(uuid, boolean) from public, anon;
grant execute on function public.resolve_household_access_request(uuid, boolean) to authenticated;
