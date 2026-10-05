alter table public.household_bills
  add column if not exists incurred_date date;

notify pgrst, 'reload schema';
