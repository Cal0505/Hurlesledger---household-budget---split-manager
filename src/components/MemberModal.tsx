import React, { useState, useEffect } from 'react';
import { X, Users, AlertCircle, Check } from 'lucide-react';
import { Member } from '../types/budget';
import { HOUSEHOLD_MEMBER_COLORS } from '../constants/memberColors';

interface MemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveMember: (memberData: Omit<Member, 'id' | 'createdAt'>, memberId?: string) => void;
  memberToEdit?: Member | null;
}

export const MemberModal: React.FC<MemberModalProps> = ({
  isOpen,
  onClose,
  onSaveMember,
  memberToEdit,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarColor, setAvatarColor] = useState(HOUSEHOLD_MEMBER_COLORS[0]);
  const [isAccountHolder, setIsAccountHolder] = useState(false);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (memberToEdit) {
      setName(memberToEdit.name);
      setEmail(memberToEdit.email || '');
      setAvatarColor(memberToEdit.avatarColor || HOUSEHOLD_MEMBER_COLORS[0]);
      setIsAccountHolder(!!memberToEdit.isAccountHolder);
      setNotes(memberToEdit.notes || '');
    } else {
      setName('');
      setEmail('');
      setAvatarColor(HOUSEHOLD_MEMBER_COLORS[Math.floor(Math.random() * HOUSEHOLD_MEMBER_COLORS.length)]);
      setIsAccountHolder(false);
      setNotes('');
    }
    setErrorMsg('');
  }, [memberToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter a member name.');
      return;
    }

    onSaveMember(
      {
        name: name.trim(),
        email: email.trim() || undefined,
        avatarColor,
        isAccountHolder,
        notes: notes.trim() || undefined,
      },
      memberToEdit?.id
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs">
      <div className="bg-white border border-neutral-200 rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-neutral-800" />
            <h3 className="text-base font-bold text-neutral-900">
              {memberToEdit ? 'Edit Household Member' : 'Add Household Member'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-md hover:bg-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Member Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Chelsea, Ebony, Lora, Carl"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs md:text-sm border border-neutral-300 rounded-md px-3 py-2 focus:ring-1 focus:ring-neutral-900 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Email Address (Optional)
            </label>
            <input
              type="email"
              placeholder="e.g. chelsea@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-xs md:text-sm border border-neutral-300 rounded-md px-3 py-2 focus:ring-1 focus:ring-neutral-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-2">
              Avatar Color Tag
            </label>
            <div className="flex items-center gap-3">
              {HOUSEHOLD_MEMBER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAvatarColor(c)}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 relative"
                  style={{ backgroundColor: c }}
                >
                  {avatarColor === c && (
                    <Check className="w-4 h-4 text-white stroke-[3]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-start gap-2.5 text-xs text-neutral-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={isAccountHolder}
                onChange={(e) => setIsAccountHolder(e.target.checked)}
                className="mt-0.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
              />
              <div>
                <span className="font-semibold text-neutral-900 block">
                  Make this person a co-host / joint account holder
                </span>
                <span className="text-neutral-500 text-[11px] block mt-0.5">
                  Hosts share household management and bank-import permissions. Mark everyone who shares the household bank account.
                </span>
              </div>
            </label>
          </div>
          <p className="text-[11px] text-neutral-500 -mt-2 pl-6">
            The person must sign in and have their login linked to this member profile before host access takes effect.
          </p>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Notes / Room Details (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Room 2, pays via standing order on 1st"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs border border-neutral-300 rounded-md px-3 py-2"
            />
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-neutral-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-neutral-900 text-white rounded-md text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-xs"
            >
              {memberToEdit ? 'Save Member' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
