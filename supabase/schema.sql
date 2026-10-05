create table if not exists public.household_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);

create table if not exists public.household_settings (
  id text primary key check (id = 'primary'),
  primary_user_id text not null default '',
  currency_symbol text not null default '£'
);

create table if not exists public.household_members (
  id text primary key,
  name text not null,
  email text,
  auth_user_id uuid references auth.users(id) on delete set null,
  avatar_color text not null,
  is_account_holder boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.household_members
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists household_members_auth_user_id_unique
  on public.household_members (auth_user_id)
  where auth_user_id is not null;

create table if not exists public.household_bills (
  id text primary key,
  name text not null,
  category text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  frequency text not null check (frequency in ('monthly', 'quarterly', 'annually', 'one-off', 'bi-weekly')),
  due_day integer not null check (due_day between 1 and 31),
  incurred_date date,
  payer_member_id text not null default '',
  payer_member_ids text[] not null default '{}',
  participating_member_ids text[] not null default '{}',
  notes text,
  is_active boolean not null default true,
  linked_outgoing_id text,
  created_at timestamptz not null default now()
);

alter table public.household_bills
  add column if not exists payer_member_ids text[] not null default '{}';

alter table public.household_bills
  add column if not exists incurred_date date;

create table if not exists public.household_transactions (
  id text primary key,
  date date not null,
  type text not null check (type in ('incoming', 'outgoing')),
  payment_method text check (payment_method is null or payment_method in ('bank', 'cash')),
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  category text not null,
  account text not null default '',
  from_member_id text,
  linked_bill_id text,
  notes text,
  source text not null check (source in ('manual', 'csv-import')),
  created_at timestamptz not null default now()
);

alter table public.household_access enable row level security;
alter table public.household_settings enable row level security;
alter table public.household_members enable row level security;
alter table public.household_bills enable row level security;
alter table public.household_transactions enable row level security;

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

drop policy if exists "Users can read their own household access" on public.household_access;
create policy "Users can read their own household access"
  on public.household_access for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Authorized users can access household settings" on public.household_settings;
create policy "Authorized users can access household settings"
  on public.household_settings for all to authenticated
  using (
    exists (
      select 1 from public.household_access access
      where access.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.household_access access
      where access.user_id = (select auth.uid())
    )
  );

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

drop policy if exists "Authorized users can access household bills" on public.household_bills;
create policy "Authorized users can access household bills"
  on public.household_bills for all to authenticated
  using (
    exists (
      select 1 from public.household_access access
      where access.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.household_access access
      where access.user_id = (select auth.uid())
    )
  );

drop policy if exists "Authorized users can access household transactions" on public.household_transactions;
create policy "Authorized users can access household transactions"
  on public.household_transactions for all to authenticated
  using (
    exists (
      select 1 from public.household_access access
      where access.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.household_access access
      where access.user_id = (select auth.uid())
    )
  );

revoke all on public.household_access from anon, authenticated;
grant select on public.household_access to authenticated;
revoke all on public.household_settings, public.household_members, public.household_bills, public.household_transactions from anon, authenticated;
grant select, insert, update, delete on public.household_settings, public.household_members, public.household_bills, public.household_transactions to authenticated;
