import React from 'react';
import { 
  LayoutDashboard, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ReceiptText, 
  Users, 
  Scale, 
  Plus, 
  Check,
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
    { id: 'dashboard', label: 'Personal Dashboard', icon: <LayoutDashboard className="w-4 h-4 shrink-0" /> },
    { id: 'incoming', label: 'Incoming', icon: <ArrowDownLeft className="w-4 h-4 shrink-0" /> },
    { id: 'outgoing', label: 'Outgoing', icon: <ArrowUpRight className="w-4 h-4 shrink-0" /> },
    { id: 'household-bills', label: 'Household Bills', icon: <ReceiptText className="w-4 h-4 shrink-0" /> },
    { id: 'members', label: isAccountHolder ? 'Member Profiles' : 'My Profile', icon: <Users className="w-4 h-4 shrink-0" />, count: isAccountHolder ? members.length : undefined },
    { id: 'settlement', label: 'Settlement Matrix', icon: <Scale className="w-4 h-4 shrink-0" /> },
  ];

  const visibleNavItems = isAccountHolder ? navItems : navItems.filter((item) => item.id === 'members');

  return (
    <>
      {isOpenMobile && (
        <div 
          className="sidebar-backdrop"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      <aside className={`
        sidebar-container
        ${isOpenMobile ? 'sidebar-open' : 'sidebar-closed'}
      `}>
        {/* Brand Lockup */}
        <div className="sidebar-header">
          <div className="flex items-center gap-3">
            <div className="sidebar-brand-icon">HL</div>
            <div>
              <span className="sidebar-brand-name">HearthLedger</span>
              <span className="sidebar-brand-tagline">Household Finance</span>
            </div>
          </div>
          <button 
            onClick={() => setIsOpenMobile(false)}
            className="sidebar-close-btn"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Navigation */}
        <div className="sidebar-content">
          <div>
            <div className="sidebar-nav-heading">
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
                    className={`sidebar-nav-item ${isActive ? 'sidebar-nav-item-active' : 'sidebar-nav-item-inactive'}`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.count !== undefined && (
                      <span className={`sidebar-nav-count ${isActive ? 'sidebar-nav-count-active' : ''}`}>
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
            <div className="sidebar-members-heading-row">
              <span className="sidebar-members-heading">Household Members</span>
              <button
                onClick={() => { onOpenAddMember(); setIsOpenMobile(false); }}
                className="sidebar-add-member-btn"
                title="Add new household member"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
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
                    onClick={() => { setSelectedMemberId(member.id); setActiveTab('members'); setIsOpenMobile(false); }}
                    className={`sidebar-member-item ${isSelected ? 'sidebar-member-selected' : 'sidebar-member-normal'}`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div 
                        className="sidebar-member-avatar"
                        style={{ backgroundColor: member.avatarColor }}
                      >
                        {member.name.charAt(0)}
                      </div>
                      <div className="truncate">
                        <span className="sidebar-member-name">{member.name}</span>
                        {member.isAccountHolder && (
                          <span className="sidebar-member-role">Account Holder</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {member.isAccountHolder ? (
                        <span className="sidebar-member-status-host">Host</span>
                      ) : isSettled ? (
                        <span className="sidebar-member-status-settled">
                          <Check className="w-3 h-3" /> Settled
                        </span>
                      ) : (
                        <span className="sidebar-member-status-owing">owes {formatCurrency(owes, currencySymbol)}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          )}
        </div>

        {/* Bottom Household Info Bar — ALL COLORS controlled in CSS only */}
        {isAccountHolder && (
          <div className="sidebar-footer-bar">
            <div className="flex items-center gap-3">
              <div className="sidebar-footer-avatar">C</div>
              <div className="min-w-0 flex-1">
                <div className="sidebar-footer-title">Your Household</div>
                <div className="sidebar-footer-subtitle">
                  {isAccountHolder ? `${members.length} household members` : 'Your member profile'}
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};