import {
  type ExpenseEntry,
  type GroupOrderSplit,
  PaymentMode,
  type ReminderPreferences,
} from '../types/expense';
import { formatINR } from './analytics';

export const DEFAULT_REMINDER_SETTINGS: ReminderPreferences = {
  enabled: false,
  nightlyTime: '21:30',
  lastNotifiedDate: null,
};

export function getLocalTodayDateStr(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalHHmm(now: Date = new Date()): string {
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
}

export function formatTime12h(hhmm: string): string {
  const [hStr = '21', mStr = '30'] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export interface NightlySpendSummary {
  date: string;
  total: number;
  onlineSpend: number;
  cashSpend: number;
  count: number;
  title: string;
  body: string;
}

export function buildNightlySummary(
  expenses: ExpenseEntry[],
  targetDate: string,
): NightlySpendSummary {
  const dayItems = expenses.filter((e) => e.date === targetDate);
  let onlineSpend = 0;
  let cashSpend = 0;

  for (const item of dayItems) {
    if (item.mode === PaymentMode.ONLINE) onlineSpend += item.amount;
    else cashSpend += item.amount;
  }

  const total = onlineSpend + cashSpend;
  const count = dayItems.length;

  if (count === 0) {
    return {
      date: targetDate,
      total: 0,
      onlineSpend: 0,
      cashSpend: 0,
      count: 0,
      title: 'CampusLedger Nightly Check-in',
      body: `No expenses logged for ${targetDate} yet. Had any cash spends or group orders today? Open CampusLedger to record them.`,
    };
  }

  return {
    date: targetDate,
    total,
    onlineSpend,
    cashSpend,
    count,
    title: `Today's Spend: ${formatINR(total)} · CampusLedger`,
    body: `Spent ${formatINR(total)} across ${count} ${
      count === 1 ? 'entry' : 'entries'
    } (Online ${formatINR(onlineSpend)} · Cash ${formatINR(
      cashSpend,
    )}). Did you miss any manual cash expenses or need to split a group order?`,
  };
}

export function shouldTriggerNightlyReminder(
  prefs: ReminderPreferences | undefined,
  now: Date = new Date(),
): boolean {
  if (!prefs || !prefs.enabled) return false;
  const todayStr = getLocalTodayDateStr(now);
  if (prefs.lastNotifiedDate === todayStr) return false;
  const currentHHmm = getLocalHHmm(now);
  return currentHHmm >= prefs.nightlyTime;
}

export function computeGroupOrderSplit(
  totalBillAmount: number,
  splitCount: number,
): GroupOrderSplit {
  const safeBill = Math.max(1, Math.round(totalBillAmount));
  const safeCount = Math.max(1, Math.min(25, Math.round(splitCount)));
  return {
    totalBillAmount: safeBill,
    splitCount: safeCount,
    yourShare: Math.round(safeBill / safeCount),
  };
}

export async function dispatchBrowserNotification(
  title: string,
  body: string,
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 800)),
      ]);
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: 'campusledger-nightly-summary',
        });
        return true;
      }
    }
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      tag: 'campusledger-nightly-summary',
    });
    return true;
  } catch {
    return false;
  }
}
