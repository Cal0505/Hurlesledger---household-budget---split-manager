import React from 'react';
import { 
  ArrowDownLeft, 
  ArrowUpRight,
  ReceiptText, 
  CheckCircle2, 
  Upload, 
  Plus, 
  ChevronRight,
  CreditCard
} from 'lucide-react';
import { HouseholdBill, Member, Transaction } from '../types/budget';
import { formatCurrency, formatDate, getOrdinalSuffix } from '../utils/formatters';
import { getMemberShareForBill } from '../utils/storage';

interface PersonalDashboardProps {
  members: Member[];
  bills: HouseholdBill[];
  transactions: Transaction[];
  signedInUserId: string;
  userEmail: string;
  currencySymbol: string;
  onNavigate: (tab: any, memberId?: string) => void;
  onOpenImportCsv: () => void;
  onOpenAddBill: () => void;
  onOpenAddTransaction: (prefill?: Partial<Transaction>) => void;
}

export const PersonalDashboard: React.FC<PersonalDashboardProps> = ({
  members,
  bills,
  transactions,
  signedInUserId,
  userEmail,
  currencySymbol,
  onNavigate,
  onOpenImportCsv,
  onOpenAddBill,
  onOpenAddTransaction,
}) => {
  const signedInMember = members.find((member) => member.authUserId === signedInUserId)
    || members.find((member) => member.email?.trim().toLowerCase() === userEmail.trim().toLowerCase());

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const personalTransactions = signedInMember
    ? transactions.filter((transaction) =>
      transaction.type === 'incoming' && transaction.fromMemberId === signedInMember.id
    )
    : [];
  const paidThisMonth = personalTransactions
    .filter((transaction) => transaction.date.startsWith(currentMonthKey))
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const personalBills = signedInMember
    ? bills.filter((bill) =>
      bill.isActive
      && bill.participatingMemberIds.includes(signedInMember.id)
      && (bill.frequency !== 'one-off' || bill.incurredDate?.startsWith(currentMonthKey))
    )
    : [];
  const personalBillShare = personalBills.reduce(
    (sum, bill) => sum + (signedInMember ? getMemberShareForBill(signedInMember.id, bill, currentMonthKey) : 0),
    0
  );
  const remainingDue = Math.max(0, personalBillShare - paidThisMonth);
  const memberBalances = signedInMember
    ? [{
      member: signedInMember,
      totalShare: personalBillShare,
      paid: paidThisMonth,
      remaining: remainingDue,
      isSettled: remainingDue === 0,
    }]
    : [];
  const recentTransactions = [...personalTransactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);
  const sortedUpcomingBills = [...personalBills].sort((a, b) => a.dueDay - b.dueDay);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome & Context Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-neutral-200">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-neutral-900 tracking-tight">
            Welcome back{signedInMember ? `, ${signedInMember.name}` : ''}
          </h2>
          <p className="text-sm text-neutral-600 mt-0.5">
            Your personal household overview.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenImportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 text-neutral-600" />
            <span>Import Bank CSV</span>
          </button>
          <button
            onClick={() => onNavigate('household-bills')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors"
          >
            <ReceiptText className="w-3.5 h-3.5" />
            <span>Manage Bills</span>
          </button>
        </div>
      </div>

      {!signedInMember && (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your account is not linked to a household member profile yet, so personal dashboard details are unavailable.
        </div>
      )}

      {/* Personal financial summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider">
              Your Payments (This Month)
            </span>
            <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">
              {formatCurrency(paidThisMonth, currencySymbol)}
            </div>
            <div className="text-xs text-neutral-600 mt-1 flex items-center gap-1.5">
              <span>Recorded for your member profile</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider">
              Your Bill Share
            </span>
            <div className="w-7 h-7 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">
              {formatCurrency(personalBillShare, currencySymbol)}
            </div>
            <div className="text-xs text-neutral-600 mt-1">
              <span>Your share of active bills</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider">
              Your Amount Due
            </span>
            <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">
              {formatCurrency(remainingDue, currencySymbol)}
            </div>
            <div className="text-xs text-emerald-700 font-medium mt-1 flex items-center gap-1">
              <span>After payments recorded this month</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider">
              Your Active Bills
            </span>
            <div className="w-7 h-7 rounded-md bg-rose-50 text-rose-700 flex items-center justify-center">
              <ReceiptText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">
              {personalBills.length}
            </div>
            <div className="text-xs text-neutral-600 mt-1">
              <span>{personalBills.length === 1 ? 'bill includes your profile' : 'bills include your profile'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Personal bill status and records */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Signed-in member bill status */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold text-neutral-900">
                  Your Bill Status
                </h3>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Your bill share and payments recorded this month
                </p>
              </div>
              <button
                onClick={() => signedInMember && onNavigate('members', signedInMember.id)}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <span>Your Profile</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-4">
              {memberBalances.map(({ member, totalShare, paid, remaining, isSettled }) => {
                const percent = totalShare > 0 ? Math.min(100, Math.round((paid / totalShare) * 100)) : 100;
                
                return (
                  <div 
                    key={member.id} 
                    className="p-4 rounded-lg border border-neutral-200 hover:border-neutral-300 transition-colors bg-neutral-50/50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-full text-white text-xs font-semibold flex items-center justify-center shrink-0"
                          style={{ backgroundColor: member.avatarColor }}
                        >
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-semibold text-neutral-900 text-sm">
                            {member.name}
                          </span>
                          <span className="text-xs text-neutral-600 ml-2">
                            Your household profile
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        {isSettled ? (
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Settled in Full
                          </span>
                        ) : (
                          <div className="text-xs text-neutral-900">
                            <span className="text-amber-700 font-semibold tabular-nums">
                              {formatCurrency(remaining, currencySymbol)}
                            </span>
                            <span className="text-neutral-600"> remaining</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-neutral-200 h-1.5 rounded-full overflow-hidden my-2.5">
                      <div 
                        className={`h-full transition-all duration-300 ${isSettled ? 'bg-emerald-500' : 'bg-blue-600'}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-neutral-600 pt-1">
                      <div className="tabular-nums">
                        Contributed: <strong className="text-neutral-800">{formatCurrency(paid, currencySymbol)}</strong> of {formatCurrency(totalShare, currencySymbol)}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => onNavigate('members', member.id)}
                          className="text-neutral-700 hover:text-neutral-900 font-medium underline underline-offset-2"
                        >
                          View Profile
                        </button>
                        {!isSettled && (
                          <button
                            onClick={() => onOpenAddTransaction({
                              type: 'incoming',
                              fromMemberId: member.id,
                              amount: remaining,
                              description: `${member.name} Bank Transfer - Household Split`,
                              category: 'Household Reimbursement'
                            })}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Record Payment
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/*           Recent Transactions */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-neutral-900">
                  Your Recent Payments
                </h3>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Payments recorded for your household profile
                </p>
              </div>
            </div>

            <div className="divide-y divide-neutral-100">
              {recentTransactions.length === 0 && (
                <p className="py-4 text-sm text-neutral-500">No payments are recorded for your profile yet.</p>
              )}
              {recentTransactions.map((tx) => {
                return (
                  <div key={tx.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-emerald-50 text-emerald-700">
                        <ArrowDownLeft className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-neutral-900 truncate">
                          {tx.description}
                        </div>
                        <div className="text-xs text-neutral-600 flex items-center gap-2">
                          <span>{formatDate(tx.date)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{tx.category}</span>
                          {tx.paymentMethod === 'cash' && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-medium text-emerald-700">Cash payment</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold tabular-nums text-emerald-700">
                        +{formatCurrency(tx.amount, currencySymbol)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bills that include the signed-in member */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-neutral-900">
                  Your Bills
                </h3>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Your share: <strong className="font-semibold text-neutral-900">{formatCurrency(personalBillShare, currencySymbol)}</strong>
                </p>
              </div>
              <button
                onClick={() => onNavigate('household-bills')}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <span>Edit Rules</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {sortedUpcomingBills.length === 0 && (
                <p className="py-4 text-sm text-neutral-500">No active bills currently include your profile.</p>
              )}
              {sortedUpcomingBills.map((bill) => {
                const personalShare = signedInMember
                  ? getMemberShareForBill(signedInMember.id, bill, currentMonthKey)
                  : 0;

                return (
                  <div 
                    key={bill.id}
                    className="p-3.5 rounded-lg border border-neutral-200 bg-white hover:border-neutral-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-sm text-neutral-900 flex items-center gap-2">
                          <span>{bill.name}</span>
                        </div>
                        <div className="text-xs text-neutral-600 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>Due {getOrdinalSuffix(bill.dueDay)} of month</span>
                          <span aria-hidden="true">·</span>
                          <span>{bill.category}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-neutral-900 tabular-nums">
                          {formatCurrency(personalShare, currencySymbol)}
                        </div>
                        <div className="text-[11px] text-neutral-600 tabular-nums">
                          Your share
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-neutral-200">
              <button
                onClick={onOpenAddBill}
                className="w-full py-2 px-3 border border-dashed border-neutral-300 hover:border-neutral-400 rounded-md text-xs font-medium text-neutral-700 hover:text-neutral-900 transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Another Household Bill</span>
              </button>
            </div>
          </div>

          {/* Quick House Rules Banner */}
          <div className="bg-neutral-100 text-neutral-900 rounded-lg p-5">
            <h4 className="font-semibold text-sm tracking-tight text-neutral-900 mb-1">
              How Split Calculations Work
            </h4>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Your share is calculated from the active household bills that include your profile. Payments recorded against your profile reduce the amount due.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
