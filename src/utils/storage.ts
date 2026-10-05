import { AppState, HouseholdBill, Member, Transaction } from '../types/budget';

export function getAccountHolderNames(members: Member[]): string[] {
  return members.filter((member) => member.isAccountHolder).map((member) => member.name);
}

export function getPrimaryAccountLabel(members: Member[]): string {
  const holders = getAccountHolderNames(members);
  if (holders.length === 0) return 'primary account';
  if (holders.length === 1) return `${holders[0]}'s account`;
  if (holders.length === 2) return `${holders[0]} & ${holders[1]}'s shared account`;
  return `${holders.slice(0, -1).join(', ')} & ${holders[holders.length - 1]}'s shared account`;
}

export function getEmptyState(): AppState {
  return {
    members: [],
    bills: [],
    transactions: [],
    primaryUserId: '',
    currencySymbol: '£',
  };
}

/**
 * RESTORED: Standard fallback per-person share computation 
 * to support dependent matrix views and solve compilation breaks.
 */
export function getBillPerPersonShare(bill: HouseholdBill): number {
  if (!bill.participatingMemberIds || bill.participatingMemberIds.length === 0) {
    return 0;
  }
  return Math.round((bill.amount / bill.participatingMemberIds.length) * 100) / 100;
}

/**
 * 🌟 SANITIZATION UTILITY: Converts full dynamic timestamps or custom 
 * dashboard markers securely down to a unpadded "YYYY-MM" base format string.
 */
function cleanMonthKey(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  return dateStr.trim().slice(0, 7);
}

/**
 * FIXED: Advanced Splitting Engine with String Normalization
 * Distributes pennies evenly so total shares exactly match the true bill cost.
 */
export function getMemberShareForBill(
  memberId: string,
  bill: HouseholdBill,
  monthFilter = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
): number {
  if (!bill.isActive) return 0;
  if (!bill.participatingMemberIds || !bill.participatingMemberIds.includes(memberId)) return 0;

  const targetMonth = cleanMonthKey(monthFilter);

  // Normalize frequency conditions so variable bills fall into their accurate monthly blocks
  if (bill.frequency === 'one-off') {
    if (cleanMonthKey(bill.incurredDate) !== targetMonth) return 0;
  } else {
    // For recurring bills, check if they started BEFORE or DURING the target month window
    if (bill.incurredDate && cleanMonthKey(bill.incurredDate) > targetMonth) return 0;
  }

  const totalParticipants = bill.participatingMemberIds.length;
  if (totalParticipants === 0) return 0;

  // Base calculation rounded down to pence
  const baseShare = Math.floor((bill.amount / totalParticipants) * 100) / 100;
  
  // Calculate remaining stray pennies (e.g., 100.00 - 99.99 = 0.01)
  const totalAllocated = baseShare * totalParticipants;
  const totalPenniesOwed = Math.round((bill.amount - totalAllocated) * 100);

  // Sort participant list alphabetically/stably so allocation is predictable
  const sortedParticipants = [...bill.participatingMemberIds].sort();
  const participantIndex = sortedParticipants.indexOf(memberId);

  // Hand out leftover pennies to the first members in the list
  if (participantIndex >= 0 && participantIndex < totalPenniesOwed) {
    return Math.round((baseShare + 0.01) * 100) / 100;
  }

  return baseShare;
}

/**
 * FIXED: Total monthly bill commitment utilizing unified month key mapping.
 */
export function getMemberTotalMonthlyBills(
  memberId: string,
  bills: HouseholdBill[],
  monthFilter?: string
): number {
  const currentMonth = monthFilter || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const targetMonth = cleanMonthKey(currentMonth);

  return bills
    .filter((bill) => bill.isActive)
    .reduce((sum, bill) => sum + getMemberShareForBill(memberId, bill, targetMonth), 0);
}

/**
 * FIXED: Checks both fields ('fromMemberId' AND 'memberId') and normalizes dates.
 */
export function getMemberTotalReimbursements(
  memberId: string,
  transactions: Transaction[],
  monthFilter?: string
): number {
  const currentMonth = monthFilter || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const targetMonth = cleanMonthKey(currentMonth);

  return transactions
    .filter((tx) => {
      if (tx.type !== 'incoming') return false;
      
      // Look for the ID match on either transaction model schema key
      const isFromMember = tx.fromMemberId === memberId || (tx as any).memberId === memberId;
      if (!isFromMember) return false;
      
      // Normalize dates before doing strict verification mapping checks
      return cleanMonthKey(tx.date) === targetMonth;
    })
    .reduce((sum, tx) => sum + tx.amount, 0);
}

/**
 * FIXED BALANCE ENGINE: Unifies host and member tracking.
 * Accurately measures what an individual owes for their assigned bill shares
 * against what they have actually reimbursed into the system.
 * Account holders (hosts/co-hosts) are treated as primary out-of-pocket payers 
 * and carry a continuous remaining balance due of 0.
 */
export function getMemberBalanceStatus(
  member: Member,
  bills: HouseholdBill[],
  transactions: Transaction[],
  monthFilter?: string
) {
  // 1. Calculate their explicit individual share of active split bills
  const totalMonthlyShare = getMemberTotalMonthlyBills(member.id, bills, monthFilter);
  
  // 2. Measure what they directly sent back as a payment clearance row
  const totalPaid = getMemberTotalReimbursements(member.id, transactions, monthFilter);
  
  // 👑 DYNAMIC ACCOUNTING PERMISSION BY ROLE:
  if (member.isAccountHolder) {
    return {
      totalMonthlyShare,
      totalPaid,
      remainingDue: 0, // Hosts are instantly settled since they pay the raw statement lines out-of-pocket
      isSettled: true,
      surplus: Math.max(0, Math.round((totalPaid - totalMonthlyShare) * 100) / 100),
    };
  }

  // Standard calculation logic for non-host household members
  const remainingDue = Math.max(0, Math.round((totalMonthlyShare - totalPaid) * 100) / 100);
  const isSettled = totalPaid >= totalMonthlyShare;
  const surplus = Math.max(0, Math.round((totalPaid - totalMonthlyShare) * 100) / 100);

  return {
    totalMonthlyShare,
    totalPaid,
    remainingDue,
    isSettled,
    surplus,
  };
}
