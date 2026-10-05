import React, { useState } from 'react';
import { Users, RotateCw } from 'lucide-react'; // 🌟 Added RotateCw icon
import { HouseholdBill, Member, Transaction } from '../types/budget';
import { HostMemberView } from './HostMemberView';
import { NonHostMemberView } from './NonHostMemberView';

interface MemberProfilesViewProps {
  members: Member[];
  bills: HouseholdBill[];
  transactions: Transaction[];
  canManageMembers: boolean;
  selectedMemberId: string | null;
  setSelectedMemberId: (id: string) => void;
  currencySymbol: string;
  onOpenAddMember: () => void;
  onEditMember: (member: Member) => void;
  onDeleteMember: (id: string) => void;
  onToggleCoHost: (member: Member) => void;
  onOpenAddTransaction: (prefill?: Partial<Transaction>) => void;
  signedInUserEmail: string;
  onLinkMemberToLogin: (memberId: string) => Promise<void>;
}

export const MemberProfilesView: React.FC<MemberProfilesViewProps> = (props) => {
  const { members, selectedMemberId, canManageMembers } = props;

  // Local calendar date hook to keep both child dashboards in sync
  const [selectedMonthDate, setSelectedMonthDate] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  const activeMemberId = selectedMemberId || (members[0]?.id ?? '');
  const activeMember = members.find((m) => m.id === activeMemberId) || members[0];

  const currentMonthKey = `${selectedMonthDate.getFullYear()}-${String(selectedMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthName = selectedMonthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  // 1. Guard check for uninitialized or empty household database arrays
  if (!activeMember) {
    return (
      <div className="p-8 text-center bg-white rounded-lg border border-neutral-200">
        <Users className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-neutral-900">No members found</h3>
        <p className="text-xs text-neutral-500 mt-1 mb-4">
          {canManageMembers
            ? 'Add household members to start splitting bills.'
            : 'Your login is not linked to a household member profile yet.'}
        </p>
        {canManageMembers && (
          <button
            onClick={props.onOpenAddMember}
            className="px-4 py-2 bg-neutral-900 text-white rounded-md text-xs font-semibold"
          >
            Add Household Member
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 🌟 SHARED REFRESH UTILITY HEADER: Accessible by both Host and Non-Host instantly */}
      <div className="flex justify-end px-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900 rounded-md transition-colors shadow-2xs cursor-pointer group"
        >
          <RotateCw className="w-3.5 h-3.5 text-neutral-500 group-hover:rotate-180 transition-transform duration-500" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* 2. Traffic routing node splitting layouts between Hosts and Roommates cleanly */}
      {!canManageMembers ? (
        <NonHostMemberView
          activeMember={activeMember}
          bills={props.bills}
          transactions={props.transactions}
          currencySymbol={props.currencySymbol}
          currentMonthKey={currentMonthKey}
          currentMonthName={currentMonthName}
          onEditMember={props.onEditMember}
          setSelectedMonthDate={setSelectedMonthDate}
        />
      ) : (
        <HostMemberView
          {...props}
          activeMember={activeMember}
          currentMonthKey={currentMonthKey}
          currentMonthName={currentMonthName}
          setSelectedMonthDate={setSelectedMonthDate}
        />
      )}
    </div>
  );
};
