begin;

do $$
declare
  carl_member public.household_members%rowtype;
  matching_user_id uuid;
  matching_user_count integer;
begin
  select count(*)
    into matching_user_count
    from public.household_members member
    where lower(trim(member.name)) = 'carl';

  if matching_user_count <> 1 then
    raise exception 'Expected exactly one household member named Carl; found %.', matching_user_count;
  end if;

  select *
    into carl_member
    from public.household_members member
    where lower(trim(member.name)) = 'carl';

  if carl_member.auth_user_id is not null then
    if not exists (
      select 1
      from public.household_access access
      where access.user_id = carl_member.auth_user_id
    ) then
      raise exception 'Carl''s linked login does not currently have household access.';
    end if;

    update public.household_members
      set is_account_holder = true
      where id = carl_member.id;
  else
    select count(*), (array_agg(users.id))[1]
      into matching_user_count, matching_user_id
      from auth.users users
      join public.household_access access
        on access.user_id = users.id
      where lower(trim(users.email)) = lower(trim(carl_member.email))
        and not exists (
          select 1
          from public.household_members linked_member
          where linked_member.auth_user_id = users.id
        );

    if matching_user_count <> 1 then
      raise exception 'Could not uniquely match Carl''s profile email to an authorized login; found % matches.', matching_user_count;
    end if;

    update public.household_members
      set auth_user_id = matching_user_id,
          is_account_holder = true
      where id = carl_member.id;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
