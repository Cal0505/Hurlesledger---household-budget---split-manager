begin;

alter table public.household_members
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists household_members_auth_user_id_unique
  on public.household_members (auth_user_id)
  where auth_user_id is not null;

alter table public.household_members
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.household_access_requests
  alter column member_id drop not null;

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

drop function if exists public.create_household_member_access_request(text);
drop function if exists public.create_household_member_access_request(text, text);
drop function if exists public.request_household_access(text);

create or replace function public.request_household_access()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  requester_id uuid := auth.uid();
  requester_email text;
  existing_request public.household_access_requests%rowtype;
begin
  if requester_id is null then
    raise exception 'Sign in before requesting household access.';
  end if;

  select users.email
    into requester_email
    from auth.users users
    where users.id = requester_id
    for update;

  if requester_email is null then
    raise exception 'Your login must have an email address before requesting household access.';
  end if;

  if exists (
    select 1 from public.household_access access
    where access.user_id = requester_id
  ) then
    raise exception 'This account already has household access.';
  end if;

  select * into existing_request
    from public.household_access_requests
    where user_id = requester_id
    for update;

  if found and existing_request.status = 'pending' then
    raise exception 'Your household access request is already awaiting approval.';
  end if;

  if found and existing_request.status = 'approved' then
    raise exception 'Your household access request has already been approved.';
  end if;

  if found then
    update public.household_access_requests
      set member_id = null,
          email = lower(requester_email),
          status = 'pending',
          created_at = now()
      where user_id = requester_id;
  else
    insert into public.household_access_requests (user_id, member_id, email, status, created_at)
    values (requester_id, null, lower(requester_email), 'pending', now());
  end if;
end;
$$;

revoke all on function public.request_household_access() from public, anon;
grant execute on function public.request_household_access() to authenticated;

create or replace function public.create_approved_household_member_profile(
  requested_member_name text,
  requested_avatar_color text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  requester_id uuid := auth.uid();
  requester_email text;
  member_name text := trim(requested_member_name);
  member_color text := lower(trim(requested_avatar_color));
  request_status text;
begin
  if requester_id is null then
    raise exception 'Sign in before creating your household profile.';
  end if;

  if member_name is null or member_name = '' or length(member_name) > 80 then
    raise exception 'Enter a name between 1 and 80 characters.';
  end if;

  if member_color is null or member_color not in (
    '#2563eb', '#10b981', '#8b5cf6', '#f59e0b',
    '#e11d48', '#06b6d4', '#4f46e5', '#0d9488'
  ) then
    raise exception 'Choose a valid avatar color.';
  end if;

  select access_request.status
    into request_status
    from public.household_access_requests access_request
    where access_request.user_id = requester_id
    for update;

  if request_status is distinct from 'approved' then
    raise exception 'Your household access request must be approved before creating your profile.';
  end if;

  if not exists (
    select 1 from public.household_access access
    where access.user_id = requester_id
  ) then
    raise exception 'Your approved request is missing household access. Ask an authorized household user to review it again.';
  end if;

  if exists (
    select 1 from public.household_members member
    where member.auth_user_id = requester_id
  ) then
    raise exception 'Your household profile has already been created.';
  end if;

  select users.email
    into requester_email
    from auth.users users
    where users.id = requester_id;

  if requester_email is null then
    raise exception 'Your login must have an email address before creating a household profile.';
  end if;

  insert into public.household_members (
    id,
    name,
    email,
    auth_user_id,
    avatar_color,
    is_account_holder,
    notes,
    created_by
  ) values (
    'mem-' || gen_random_uuid()::text,
    member_name,
    lower(requester_email),
    requester_id,
    member_color,
    false,
    null,
    requester_id
  );
end;
$$;

revoke all on function public.create_approved_household_member_profile(text, text) from public, anon;
grant execute on function public.create_approved_household_member_profile(text, text) to authenticated;

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
