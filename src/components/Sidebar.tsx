import React from 'react';
import { 
  LayoutDashboard, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ReceiptText, 
  Users, 
  Scale, 
  Plus, 
  Home, 
  Check, 
  AlertCircle,
  Menu,
  X
} from 'lucide-react';
import { ActiveTab, Member } from '../types/budget';
import { formatCurrency } from '../utils/formatters';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  selectedMemberId: string | null;
  setSelectedMemberId: (id: string | null) => void;
  members: Member[];
  isAccountHolder: boolean;
  onOpenAddMember: () => void;
  currencySymbol: string;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
  memberBalances: Record<string, { totalMonthlyShare: number; totalPaid: number; remainingDue: number }>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  selectedMemberId,
  setSelectedMemberId,
  members,
  isAccountHolder,
  onOpenAddMember,
  currencySymbol,
  isOpenMobile,
  setIsOpenMobile,
  memberBalances,
}) => {
  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; count?: number }[] = [
    {
      id: 'dashboard',
      label: 'Personal Dashboard',
      icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'incoming',
      label: 'Incoming',
      icon: <ArrowDownLeft className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'outgoing',
      label: 'Outgoing',
      icon: <ArrowUpRight className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'household-bills',
      label: 'Household Bills',
      icon: <ReceiptText className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'members',
      label: isAccountHolder ? 'Member Profiles' : 'My Profile',
      icon: <Users className="w-4 h-4 shrink-0" />,
      count: isAccountHolder ? members.length : undefined,
    },
    {
      id: 'settlement',
      label: 'Settlement Matrix',
      icon: <Scale className="w-4 h-4 shrink-0" />,
    },
  ];
  const visibleNavItems = isAccountHolder
    ? navItems
    : navItems.filter((item) => item.id === 'members');

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div 
          className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-72 bg-white border-r border-neutral-200 flex flex-col
        transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto
        ${isOpenMobile ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand Lockup */}
        <div className="h-16 px-6 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-bold text-sm tracking-wider">
              HL
            </div>
            <div>
              <span className="font-semibold text-neutral-900 tracking-tight block text-base leading-tight">
                HearthLedger
              </span>
              <span className="text-xs text-neutral-600 block">
                Household Finance
              </span>
            </div>
          </div>
          <button 
            onClick={() => setIsOpenMobile(false)}
            className="lg:hidden p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Navigation */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          <div>
            <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-neutral-600">
              {isAccountHolder ? 'Overview & Flows' : 'Your Profile'}
            </div>
            <nav className="space-y-1">
              {visibleNavItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      if (item.id === 'members' && !selectedMemberId && members.length > 0) {
                        setSelectedMemberId(members[0].id);
                      }
                      setIsOpenMobile(false);
                    }}
                    className={`
                      w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md
                      transition-colors text-left
                      ${isActive 
                        ? 'bg-neutral-900 text-white shadow-xs' 
                        : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3 truncate">
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.count !== undefined && (
                      <span className={`text-xs tabular-nums ${isActive ? 'text-neutral-300' : 'text-neutral-600'}`}>
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Household Members Quick Access */}
          {isAccountHolder && (
          <div>
            <div className="px-2 pb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
                Household Members
              </span>
              {isAccountHolder && (
                <button
                  onClick={() => {
                    onOpenAddMember();
                    setIsOpenMobile(false);
                  }}
                  className="text-xs text-neutral-600 hover:text-neutral-900 flex items-center gap-1 font-medium transition-colors"
                  title="Add new household member"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              )}
            </div>

            <div className="space-y-1">
              {members.map((member) => {
                const isSelected = activeTab === 'members' && selectedMemberId === member.id;
                const balance = memberBalances[member.id];
                const owes = balance ? balance.remainingDue : 0;
                const isSettled = balance && balance.totalPaid >= balance.totalMonthlyShare;

                return (
                  <button
                    key={member.id}
                    onClick={() => {
                      setSelectedMemberId(member.id);
                      setActiveTab('members');
                      setIsOpenMobile(false);
                    }}
                    className={`
                      w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors text-left
                      ${isSelected 
                        ? 'bg-neutral-100 text-neutral-900 font-semibold' 
                        : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div 
                        className="w-6 h-6 rounded-full text-white text-xs font-semibold flex items-center justify-center shrink-0"
                        style={{ backgroundColor: member.avatarColor }}
                      >
                        {member.name.charAt(0)}
                      </div>
                      <div className="truncate">
                        <span className="truncate block leading-tight text-neutral-900">
                          {member.name}
                        </span>
                        {member.isAccountHolder && (
                          <span className="text-[10px] text-neutral-600 block leading-tight">
                            Account Holder
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {member.isAccountHolder ? (
                        <span className="text-[11px] text-neutral-600 tabular-nums">
                          Host
                        </span>
                      ) : isSettled ? (
                        <span className="text-[11px] text-emerald-700 font-medium tabular-nums flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          Settled
                        </span>
                      ) : (
                        <span className="text-[11px] text-amber-700 font-medium tabular-nums">
                          owes {formatCurrency(owes, currencySymbol)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          )}
        </div>

        {/* Bottom Household Info Bar */}
        {isAccountHolder && <div className="p-4 border-t border-neutral-200 bg-neutral-50/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
              C
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-neutral-900 truncate">
                Your Household
              </div>
              <div className="text-[11px] text-neutral-600 truncate">
                {isAccountHolder ? `${members.length} household members` : 'Your member profile'}
              </div>
            </div>
          </div>
        </div>}
      </aside>
    </>
  );
};
