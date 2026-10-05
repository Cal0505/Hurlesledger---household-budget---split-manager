export interface Member {
  id: string;
  name: string;
  email?: string;
  authUserId?: string;
  avatarColor: string;
  isAccountHolder?: boolean; // Carl or primary account holder
  notes?: string;
  createdAt: string;
}

export interface HouseholdAccessRequest {
  userId: string;
  memberId: string | null;
  memberName: string;
  email: string;
  createdAt: string;
}

export type BillFrequency = 'monthly' | 'quarterly' | 'annually' | 'one-off' | 'bi-weekly';

export type BillCategory = 
  | 'Utilities'
  | 'Entertainment & Subscriptions'
  | 'Internet & Tech'
  | 'Housing & Rent'
  | 'Groceries & Household'
  | 'Insurance & Tax'
  | 'Other';

export interface HouseholdBill {
  id: string;
  name: string; // e.g. "Deezer Family", "Virgin Media Broadband", "British Gas Energy"
  category: BillCategory;
  amount: number; // e.g. 14.99 or 48.00
  frequency: BillFrequency;
  dueDay: number; // day of month 1-31
  incurredDate?: string; // YYYY-MM-DD for statement-imported one-off bills
  payerMemberId: string; // Member who pays the bill directly (e.g. Carl)
  payerMemberIds?: string[]; // Multiple members can represent a joint account
  participatingMemberIds: string[]; // Members who use/split the bill
  notes?: string;
  isActive: boolean;
  linkedOutgoingId?: string;
  createdAt: string;
}

export type TransactionType = 'incoming' | 'outgoing';

export type IncomingCategory = 
  | 'Salary / Wage'
  | 'Household Reimbursement'
  | 'Freelance / Side Gig'
  | 'Transfer / Refund'
  | 'Investment / Interest'
  | 'Other Income';

export type OutgoingCategory = 
  | 'Household Bills'
  | 'Rent / Mortgage'
  | 'Groceries'
  | 'Personal Subscriptions'
  | 'Dining & Takeout'
  | 'Transport'
  | 'Shopping & Goods'
  | 'Healthcare'
  | 'Other Expense';

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  paymentMethod?: 'bank' | 'cash';
  description: string;
  amount: number;
  category: string;
  account: string; // e.g. "Main Bank Account"
  fromMemberId?: string; // If this is an incoming reimbursement from e.g. Chelsea, Ebony, Lora
  linkedBillId?: string; // If linked to a household bill
  notes?: string;
  source: 'manual' | 'csv-import';
  createdAt: string;
}

export type ActiveTab = 
  | 'dashboard'
  | 'incoming'
  | 'outgoing'
  | 'household-bills'
  | 'members'
  | 'settlement';

export interface AppState {
  members: Member[];
  bills: HouseholdBill[];
  transactions: Transaction[];
  primaryUserId: string; // ID of the personal dashboard user (default: Carl)
  currencySymbol: string; // default '£'
}
