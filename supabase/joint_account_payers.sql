alter table public.household_bills
  add column if not exists payer_member_ids text[] not null default '{}';

update public.household_bills
set payer_member_ids = array[payer_member_id]
where cardinality(payer_member_ids) = 0
  and payer_member_id <> '';

update public.household_transactions as transactions
set linked_bill_id = null
where transactions.type = 'outgoing'
  and transactions.source = 'csv-import'
  and transactions.linked_bill_id is not null
  and not exists (
    select 1
    from public.household_bills as bills
    where bills.id = transactions.linked_bill_id
  );

notify pgrst, 'reload schema';
