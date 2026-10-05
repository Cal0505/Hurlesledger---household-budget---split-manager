import type { SupabaseClient } from '@supabase/supabase-js';
import { AppState, HouseholdAccessRequest, HouseholdBill, Member, Transaction } from '../types/budget';
import { getEmptyState } from './storage';

type Identified = { id: string };

function throwDatabaseError(action: string, error: unknown): void {
  if (!error) return;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const details = error as { message: string; code?: string; hint?: string; details?: string };
    const code = details.code ? ` (${details.code})` : '';
    const extra = details.hint || details.details;
    throw new Error(`${action}: ${details.message}${code}${extra ? ` — ${extra}` : ''}`);
  }
  throw new Error(`${action}: ${error instanceof Error ? error.message : String(error)}`);
}

function changedRows<T extends Identified>(before: T[], after: T[]): T[] {
  const previousById = new Map(before.map((row) => [row.id, row]));
  return after.filter((row) => JSON.stringify(previousById.get(row.id)) !== JSON.stringify(row));
}

function deletedIds<T extends Identified>(before: T[], after: T[]): string[] {
  const nextIds = new Set(after.map((row) => row.id));
  return before.filter((row) => !nextIds.has(row.id)).map((row) => row.id);
}

async function syncRows<T extends Identified>(
  client: SupabaseClient,
  table: 'household_members' | 'household_bills' | 'household_transactions',
  before: T[],
  after: T[],
  toRow: (row: T) => Record<string, unknown>
): Promise<void> {
  const updates = changedRows(before, after);
  if (updates.length > 0) {
    const { error } = await client.from(table).upsert(updates.map(toRow));
    throwDatabaseError(`Could not save ${table}`, error);
  }

  const removed = deletedIds(before, after);
  if (removed.length > 0) {
    const { error } = await client.from(table).delete().in('id', removed);
    throwDatabaseError(`Could not delete from ${table}`, error);
  }
}

export async function loadHouseholdData(client: SupabaseClient): Promise<AppState> {
  const { data: access, error: accessError } = await client
    .from('household_access')
    .select('user_id')
    .maybeSingle();
  throwDatabaseError('Could not check household access', accessError);
  if (!access) {
    throw new Error('Your account is not yet authorized for this household. Ask the project administrator to grant access.');
  }

  const [membersResult, billsResult, transactionsResult, settingsResult] = await Promise.all([
    client.from('household_members').select('*').order('created_at'),
    client.from('household_bills').select('*').order('created_at'),
    client.from('household_transactions').select('*').order('date', { ascending: false }),
    client.from('household_settings').select('*').eq('id', 'primary').maybeSingle(),
  ]);
  throwDatabaseError('Could not load household members', membersResult.error);
  throwDatabaseError('Could not load household bills', billsResult.error);
  throwDatabaseError('Could not load household transactions', transactionsResult.error);
  throwDatabaseError('Could not load household settings', settingsResult.error);

  const state = getEmptyState();
  state.members = (membersResult.data || []).map((row): Member => ({
    id: row.id,
    name: row.name,
    email: row.email || undefined,
    authUserId: row.auth_user_id || undefined,
    avatarColor: row.avatar_color,
    isAccountHolder: row.is_account_holder,
    notes: row.notes || undefined,
    createdAt: row.created_at,
  }));
  state.bills = (billsResult.data || []).map((row): HouseholdBill => ({
    id: row.id,
    name: row.name,
    category: row.category,
    amount: Number(row.amount),
    frequency: row.frequency,
    dueDay: row.due_day,
    incurredDate: row.incurred_date || undefined,
    payerMemberId: row.payer_member_id,
    payerMemberIds: row.payer_member_ids?.length
      ? row.payer_member_ids
      : row.payer_member_id ? [row.payer_member_id] : [],
    participatingMemberIds: row.participating_member_ids || [],
    notes: row.notes || undefined,
    isActive: row.is_active,
    linkedOutgoingId: row.linked_outgoing_id || undefined,
    createdAt: row.created_at,
  }));
  state.transactions = (transactionsResult.data || []).map((row): Transaction => ({
    id: row.id,
    date: row.date,
    type: row.type,
    paymentMethod: row.payment_method || undefined,
    description: row.description,
    amount: Number(row.amount),
    category: row.category,
    account: row.account,
    fromMemberId: row.from_member_id || undefined,
    linkedBillId: row.linked_bill_id || undefined,
    notes: row.notes || undefined,
    source: row.source,
    createdAt: row.created_at,
  }));

  if (settingsResult.data) {
    state.primaryUserId = settingsResult.data.primary_user_id;
    state.currencySymbol = settingsResult.data.currency_symbol;
  }

  return state;
}

export async function listUnlinkedHouseholdMembers(
  client: SupabaseClient
): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await client.rpc('list_unlinked_household_members');
  throwDatabaseError('Could not load household member choices', error);
  return (data || []).map((row: { id: string; name: string }) => ({ id: row.id, name: row.name }));
}

export async function submitHouseholdAccessRequest(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc('request_household_access');
  throwDatabaseError('Could not submit your household access request', error);
}

export async function createApprovedHouseholdMemberProfile(
  client: SupabaseClient,
  name: string,
  avatarColor: string
): Promise<void> {
  const { error } = await client.rpc('create_approved_household_member_profile', {
    requested_member_name: name.trim(),
    requested_avatar_color: avatarColor,
  });
  throwDatabaseError('Could not create your approved household profile', error);
}

export async function linkCurrentUserToHouseholdMember(
  client: SupabaseClient,
  memberId: string
): Promise<void> {
  const { error } = await client.rpc('link_own_household_member', {
    requested_member_id: memberId,
  });
  throwDatabaseError('Could not link your login to this member', error);
}

export async function getHouseholdAccessStatus(
  client: SupabaseClient,
  userId: string
): Promise<'authorized' | 'profile' | 'pending' | 'denied' | 'none'> {
  const { data: request, error: requestError } = await client
    .from('household_access_requests')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle();
  throwDatabaseError('Could not check your access request', requestError);

  if (request?.status === 'pending') return 'pending';
  if (request?.status === 'denied') return 'denied';

  const { data: access, error: accessError } = await client
    .from('household_access')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  throwDatabaseError('Could not check household access', accessError);
  if (access) {
    const { data: member, error: memberError } = await client
      .from('household_members')
      .select('id')
      .eq('auth_user_id', userId)
      .maybeSingle();
    throwDatabaseError('Could not check your household profile', memberError);
    if (member) return 'authorized';
    if (request?.status === 'approved') return 'profile';
    throw new Error('Your account has household access but no approved access request or linked profile. Ask a household administrator to review your access.');
  }

  if (request?.status === 'approved') {
    throw new Error('Your request is approved but household access was not granted. Ask a household administrator to review your access.');
  }
  return 'none';
}

export async function listPendingHouseholdAccessRequests(
  client: SupabaseClient
): Promise<HouseholdAccessRequest[]> {
  const pageSize = 1000;
  const rows: Array<{
    user_id: string;
    member_id: string | null;
    email: string;
    created_at: string;
  }> = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from('household_access_requests')
      .select('user_id, member_id, email, created_at')
      .eq('status', 'pending')
      .order('created_at')
      .order('user_id')
      .range(offset, offset + pageSize - 1);
    throwDatabaseError('Could not load access requests', error);

    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  const memberIds = [...new Set(rows.flatMap((row) => row.member_id ? [row.member_id] : []))];
  const memberNames = new Map<string, string>();
  if (memberIds.length > 0) {
    const { data, error } = await client
      .from('household_members')
      .select('id, name')
      .in('id', memberIds);
    throwDatabaseError('Could not load requested household member names', error);
    for (const member of data || []) {
      memberNames.set(member.id, member.name);
    }
  }

  return rows.map((row) => ({
    userId: row.user_id,
    memberId: row.member_id,
    email: row.email,
    createdAt: row.created_at,
    memberName: row.member_id ? memberNames.get(row.member_id) || '' : '',
  }));
}

export async function resolveHouseholdAccessRequest(
  client: SupabaseClient,
  userId: string,
  approve: boolean
): Promise<void> {
  const { error } = await client.rpc('resolve_household_access_request', {
    requested_user_id: userId,
    approve_request: approve,
  });
  throwDatabaseError(approve ? 'Could not approve access request' : 'Could not deny access request', error);
}

export async function saveHouseholdChanges(
  client: SupabaseClient,
  before: AppState,
  after: AppState
): Promise<void> {
  await syncRows<Member>(
    client,
    'household_members',
    before.members,
    after.members,
    (member) => ({
      id: member.id,
      name: member.name,
      email: member.email || null,
      auth_user_id: member.authUserId || null,
      avatar_color: member.avatarColor,
      is_account_holder: !!member.isAccountHolder,
      notes: member.notes || null,
      created_at: member.createdAt,
    })
  );
  await syncRows<HouseholdBill>(
    client,
    'household_bills',
    before.bills,
    after.bills,
    (bill) => ({
      id: bill.id,
      name: bill.name,
      category: bill.category,
      amount: bill.amount,
      frequency: bill.frequency,
      due_day: bill.dueDay,
      incurred_date: bill.incurredDate || null,
      payer_member_id: bill.payerMemberIds?.[0] || bill.payerMemberId,
      payer_member_ids: bill.payerMemberIds?.length ? bill.payerMemberIds : [bill.payerMemberId],
      participating_member_ids: bill.participatingMemberIds,
      notes: bill.notes || null,
      is_active: bill.isActive,
      linked_outgoing_id: bill.linkedOutgoingId || null,
      created_at: bill.createdAt,
    })
  );
  await syncRows<Transaction>(
    client,
    'household_transactions',
    before.transactions,
    after.transactions,
    (transaction) => ({
      id: transaction.id,
      date: transaction.date,
      type: transaction.type,
      payment_method: transaction.paymentMethod || null,
      description: transaction.description,
      amount: transaction.amount,
      category: transaction.category,
      account: transaction.account,
      from_member_id: transaction.fromMemberId || null,
      linked_bill_id: transaction.linkedBillId || null,
      notes: transaction.notes || null,
      source: transaction.source,
      created_at: transaction.createdAt,
    })
  );

  if (
    before.primaryUserId !== after.primaryUserId ||
    before.currencySymbol !== after.currencySymbol
  ) {
    const { error } = await client.from('household_settings').upsert({
      id: 'primary',
      primary_user_id: after.primaryUserId,
      currency_symbol: after.currencySymbol,
    });
    throwDatabaseError('Could not save household settings', error);
  }
}
