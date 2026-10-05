import React, { useEffect, useRef, useState } from 'react';
import { LogOut, Menu, Monitor, Moon, Plus, Settings, Sun, Upload } from 'lucide-react';
import { ActiveTab, Transaction } from '../types/budget';

export type ThemeMode = 'light' | 'dark' | 'system';

interface HeaderProps {
  activeTab: ActiveTab;
  isAccountHolder: boolean;
  onOpenImportCsv: () => void;
  onOpenAddBill: () => void;
  onOpenAddTransaction: (prefill?: Partial<Transaction>) => void;
  onOpenMobileMenu: () => void;
  themeMode: ThemeMode;
  onChangeTheme: (theme: ThemeMode) => void;
  userEmail: string;
  onSignOut: () => Promise<void>;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  isAccountHolder,
  onOpenImportCsv,
  onOpenAddBill,
  onOpenAddTransaction,
  onOpenMobileMenu,
  themeMode,
  onChangeTheme,
  userEmail,
  onSignOut,
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!settingsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !settingsRef.current?.contains(event.target)) {
        setSettingsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSettingsOpen(false);
        settingsButtonRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [settingsOpen]);

  const getBreadcrumbTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Personal Dashboard';
      case 'incoming':
        return 'Incoming Money & Deposits';
      case 'outgoing':
        return 'Outgoing Expenses & Debits';
      case 'household-bills':
        return 'Household Bills & Split Rules';
      case 'members':
        return 'Member Profiles & Allocations';
      case 'settlement':
        return 'Settlement Matrix & Balances';
      default:
        return 'Dashboard';
    }
  };

  const today = new Date();
  const currentMonthYear = today.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <header className="h-16 px-4 md:px-8 border-b border-neutral-200 bg-white flex items-center justify-between shrink-0 sticky top-0 z-30">
      {/* Zone 1: Breadcrumb Trail */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-neutral-600 font-medium hidden sm:inline">Hearth</span>
          <span className="text-neutral-400 hidden sm:inline" aria-hidden="true">/</span>
          <h1 className="text-sm md:text-base font-semibold text-neutral-900 tracking-tight">
            {getBreadcrumbTitle()}
          </h1>
        </div>
      </div>

      {/* Zone 2: Month / Household context */}
      {isAccountHolder && (
      <div className="hidden md:flex items-center gap-2 text-xs text-neutral-600">
        <span>Cycle: <strong className="font-semibold text-neutral-800">{currentMonthYear}</strong></span>
        <span aria-hidden="true">·</span>
        <span>Account: <strong className="font-semibold text-neutral-800">Lora &amp; Carl (Shared)</strong></span>
      </div>
      )}

      {/* Zone 3: Primary Actions */}
      <div className="flex items-center gap-1 sm:gap-2">
        {isAccountHolder && <>
        <button
          onClick={onOpenImportCsv}
          className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors whitespace-nowrap"
          title="Import bank statement CSV"
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Import CSV</span>
        </button>

        {activeTab === 'household-bills' ? (
          <button
            onClick={onOpenAddBill}
            className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-md transition-colors whitespace-nowrap shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Bill</span>
          </button>
        ) : (
          <button
            onClick={() => onOpenAddTransaction()}
            className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-md transition-colors whitespace-nowrap shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Record Flow</span>
          </button>
        )}
        </>}

        <div className="relative" ref={settingsRef}>
          <button
            ref={settingsButtonRef}
            type="button"
            onClick={() => {
              setSettingsOpen((open) => !open);
              setSignOutError('');
            }}
            className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
            aria-label="Open settings"
            aria-expanded={settingsOpen}
            aria-haspopup="dialog"
          >
            <Settings className="w-4 h-4" />
          </button>

          {settingsOpen && (
            <div
              role="dialog"
              aria-label="Settings"
              className="absolute right-0 top-11 z-50 w-72 rounded-xl border border-neutral-200 bg-white p-4 shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-900">Appearance</h2>
                  <p className="mt-0.5 text-xs text-neutral-500">Choose how HearthLedger looks.</p>
                </div>
                <Settings className="w-4 h-4 text-neutral-400 mt-0.5" />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-neutral-100 p-1">
                {([
                  { value: 'light', label: 'Light', Icon: Sun },
                  { value: 'dark', label: 'Dark', Icon: Moon },
                  { value: 'system', label: 'System', Icon: Monitor },
                ] as const).map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onChangeTheme(value)}
                    aria-pressed={themeMode === value}
                    className={`flex flex-col items-center gap-1 rounded-md px-2 py-2 text-[11px] font-medium transition-colors ${
                      themeMode === value
                        ? 'bg-white text-neutral-900 shadow-sm'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-4 border-t border-neutral-100 pt-3">
                <div className="mb-2 truncate text-xs text-neutral-600" title={userEmail}>
                  Signed in as <span className="font-medium text-neutral-800">{userEmail}</span>
                </div>
                {signOutError && (
                  <p role="alert" className="mb-2 text-xs text-rose-700">{signOutError}</p>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await onSignOut();
                    } catch (error) {
                      setSignOutError(error instanceof Error ? error.message : 'Sign out failed.');
                    }
                  }}
                  className="inline-flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
