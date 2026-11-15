import assert from 'node:assert/strict';
import test from 'node:test';
import { ExpenseCategory, type ExpenseEntry, PaymentMode } from '../types/expense';
import {
  buildNightlySummary,
  computeGroupOrderSplit,
  formatTime12h,
  shouldTriggerNightlyReminder,
} from './reminders';

const SAMPLE_DAY: ExpenseEntry[] = [
  {
    id: 'e1',
    merchant: 'Zomato · Biryani',
    amount: 349,
    date: '2026-11-15',
    time: '13:10',
    mode: PaymentMode.ONLINE,
    category: ExpenseCategory.FOOD,
    appId: 'zomato',
    source: 'app_sync',
  },
  {
    id: 'e2',
    merchant: 'Canteen Tea',
    amount: 95,
    date: '2026-11-15',
    time: '17:20',
    mode: PaymentMode.CASH,
    category: ExpenseCategory.FOOD,
    appId: 'manual',
    source: 'manual',
  },
  {
    id: 'e3',
    merchant: 'Older Order',
    amount: 500,
    date: '2026-11-14',
    time: '19:00',
    mode: PaymentMode.ONLINE,
    category: ExpenseCategory.SHOPPING,
    appId: 'amazon',
    source: 'app_sync',
  },
];

test('buildNightlySummary sums only targetDate expenses across Online and Cash', () => {
  const summary = buildNightlySummary(SAMPLE_DAY, '2026-11-15');
  assert.equal(summary.total, 444);
  assert.equal(summary.onlineSpend, 349);
  assert.equal(summary.cashSpend, 95);
  assert.equal(summary.count, 2);
  assert.match(summary.title, /₹444/);
  assert.match(summary.body, /Online ₹349/);
  assert.match(summary.body, /Cash ₹95/);
});

test('buildNightlySummary handles empty day with helpful manual expense prompt', () => {
  const summary = buildNightlySummary(SAMPLE_DAY, '2026-11-20');
  assert.equal(summary.total, 0);
  assert.equal(summary.count, 0);
  assert.match(summary.body, /No expenses logged/);
});

test('shouldTriggerNightlyReminder respects enabled flag, schedule time, and once-per-day guard', () => {
  const atNinePm = new Date(2026, 10, 15, 21, 0, 0);
  const atNineFortyPm = new Date(2026, 10, 15, 21, 40, 0);

  assert.equal(
    shouldTriggerNightlyReminder(
      { enabled: false, nightlyTime: '21:30', lastNotifiedDate: null },
      atNineFortyPm,
    ),
    false,
  );
  assert.equal(
    shouldTriggerNightlyReminder(
      { enabled: true, nightlyTime: '21:30', lastNotifiedDate: null },
      atNinePm,
    ),
    false,
  );
  assert.equal(
    shouldTriggerNightlyReminder(
      { enabled: true, nightlyTime: '21:30', lastNotifiedDate: null },
      atNineFortyPm,
    ),
    true,
  );
  assert.equal(
    shouldTriggerNightlyReminder(
      { enabled: true, nightlyTime: '21:30', lastNotifiedDate: '2026-11-15' },
      atNineFortyPm,
    ),
    false,
  );
});

test('computeGroupOrderSplit divides total bill cleanly and formatTime12h formats 24h time', () => {
  const split = computeGroupOrderSplit(1200, 4);
  assert.deepEqual(split, {
    totalBillAmount: 1200,
    splitCount: 4,
    yourShare: 300,
  });
  assert.equal(formatTime12h('21:30'), '9:30 PM');
  assert.equal(formatTime12h('09:05'), '9:05 AM');
});
