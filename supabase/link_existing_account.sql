create or replace function public.link_own_household_member(requested_member_id text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  account_email text;
  email_verified timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Sign in before linking your household profile.';
  end if;

  if not exists (
    select 1 from public.household_access access
    where access.user_id = auth.uid()
  ) then
    raise exception 'Your account must already have authorized household access to link a profile.';
  end if;

  select users.email, users.email_confirmed_at
    into account_email, email_verified
    from auth.users users
    where users.id = auth.uid();

  if account_email is null or email_verified is null then
    raise exception 'Verify your email address before linking a household profile.';
  end if;

  update public.household_members
    set auth_user_id = auth.uid()
    where id = requested_member_id
      and auth_user_id is null
      and lower(trim(email)) = lower(trim(account_email));

  if not found then
    raise exception 'This member must have the same email as your verified login and must not already be linked.';
  end if;
end;
$$;

revoke all on function public.link_own_household_member(text) from public, anon;
grant execute on function public.link_own_household_member(text) to authenticated;
