import {
  type ExpenseEntry,
  type RecurringExpense,
} from '../types/expense';

export const AVATAR_COLOR_SWATCHES: Array<{ hex: string; label: string }> = [
  { hex: '#0F766E', label: 'Deep Teal' },
  { hex: '#1D4ED8', label: 'Rail Blue' },
  { hex: '#4F46E5', label: 'Indigo' },
  { hex: '#047857', label: 'Emerald' },
  { hex: '#B45309', label: 'Amber' },
  { hex: '#334155', label: 'Slate' },
];

export const PROFILE_ROLE_PRESETS = [
  'Personal Finance',
  'Working Professional',
  'Student',
  'Freelancer',
  'Family Budget',
] as const;

export function buildExpenseFromRecurring(
  bill: RecurringExpense,
  targetMonth: string,
): ExpenseEntry {
  const safeMonth = /^\d{4}-\d{2}$/.test(targetMonth)
    ? targetMonth
    : new Date().toISOString().slice(0, 7);
  const clampedDay = Math.max(1, Math.min(28, Math.round(bill.dayOfMonth || 1)));
  const dayStr = String(clampedDay).padStart(2, '0');

  return {
    id: `rec-${bill.id}-${safeMonth}-${Date.now()}`,
    merchant: bill.merchant.trim(),
    amount: Math.round(bill.amount),
    date: `${safeMonth}-${dayStr}`,
    time: '09:00',
    mode: bill.mode,
    category: bill.category,
    appId: bill.appId,
    source: 'manual',
    notes: bill.notes?.trim()
      ? `Recurring bill · ${bill.notes.trim()}`
      : 'Recurring monthly bill',
  };
}

export function computeRecurringSummary(
  bills: RecurringExpense[],
  targetMonth: string,
): {
  totalMonthlyCommitted: number;
  loggedCount: number;
  pendingCount: number;
  pendingAmount: number;
} {
  let totalMonthlyCommitted = 0;
  let loggedCount = 0;
  let pendingAmount = 0;

  for (const bill of bills) {
    const amt = Math.round(bill.amount);
    totalMonthlyCommitted += amt;
    if (bill.lastLoggedMonth === targetMonth) {
      loggedCount += 1;
    } else {
      pendingAmount += amt;
    }
  }

  return {
    totalMonthlyCommitted,
    loggedCount,
    pendingCount: bills.length - loggedCount,
    pendingAmount,
  };
}
