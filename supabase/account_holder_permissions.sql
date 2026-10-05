begin;

alter table public.household_members
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists household_members_auth_user_id_unique
  on public.household_members (auth_user_id)
  where auth_user_id is not null;

with candidates as (
  select
    member.id as member_id,
    access.user_id,
    count(*) over (partition by access.user_id) as members_for_user,
    count(*) over (partition by member.id) as users_for_member
  from public.household_members member
  join auth.users users
    on lower(trim(users.email)) = lower(trim(member.email))
  join public.household_access access
    on access.user_id = users.id
  where member.is_account_holder
    and member.auth_user_id is null
    and not exists (
      select 1
      from public.household_members linked_member
      where linked_member.auth_user_id = access.user_id
    )
)
update public.household_members member
  set auth_user_id = candidates.user_id
  from candidates
  where member.id = candidates.member_id
    and candidates.members_for_user = 1
    and candidates.users_for_member = 1;

create or replace function public.is_household_account_holder()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.household_members member
    where member.auth_user_id = (select auth.uid())
      and member.is_account_holder
      and exists (
        select 1 from public.household_access access
        where access.user_id = (select auth.uid())
      )
  );
$$;

revoke all on function public.is_household_account_holder() from public, anon;
grant execute on function public.is_household_account_holder() to authenticated;

alter table public.household_members enable row level security;
drop policy if exists "Authorized users can access household members" on public.household_members;
drop policy if exists "Account holders can manage household members" on public.household_members;
drop policy if exists "Users can read their own member profile" on public.household_members;
drop policy if exists "Only account holders can add household members" on public.household_members;
drop policy if exists "Only account holders can update household members" on public.household_members;
drop policy if exists "Only account holders can delete household members" on public.household_members;

create policy "Users can read their own member profile"
  on public.household_members for select to authenticated
  using (
    (
      auth_user_id = (select auth.uid())
      and exists (
        select 1 from public.household_access access
        where access.user_id = (select auth.uid())
      )
    )
    or (select public.is_household_account_holder())
  );

create policy "Only account holders can add household members"
  on public.household_members for insert to authenticated
  with check ((select public.is_household_account_holder()));

create policy "Only account holders can update household members"
  on public.household_members for update to authenticated
  using ((select public.is_household_account_holder()))
  with check ((select public.is_household_account_holder()));

create policy "Only account holders can delete household members"
  on public.household_members for delete to authenticated
  using ((select public.is_household_account_holder()));

alter table public.household_access_requests enable row level security;
drop policy if exists "Requesters and household users can read access requests"
  on public.household_access_requests;
drop policy if exists "Requesters and account holders can read access requests"
  on public.household_access_requests;
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
    if request_row.member_id is not null then
      update public.household_members
        set auth_user_id = request_row.user_id,
            email = request_row.email
        where id = request_row.member_id
          and auth_user_id is null;

      if not found then
        raise exception 'This household member has already been linked to another account.';
      end if;
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

notify pgrst, 'reload schema';

commit;
