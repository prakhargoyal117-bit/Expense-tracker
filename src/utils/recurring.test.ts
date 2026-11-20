import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ExpenseCategory,
  PaymentMode,
  type RecurringExpense,
} from '../types/expense';
import { computeSafeDailyLimit, formatAppLabel } from './analytics';
import {
  buildExpenseFromRecurring,
  computeRecurringSummary,
} from './recurring';

const SAMPLE_BILLS: RecurringExpense[] = [
  {
    id: 'b1',
    merchant: 'Jio Fiber Broadband',
    amount: 999,
    category: ExpenseCategory.OTHER,
    appId: 'upi_payment',
    mode: PaymentMode.ONLINE,
    dayOfMonth: 5,
    lastLoggedMonth: '2026-11',
  },
  {
    id: 'b2',
    merchant: 'IRCTC Monthly Rail Pass',
    amount: 1200,
    category: ExpenseCategory.TRANSPORT,
    appId: 'irctc',
    mode: PaymentMode.ONLINE,
    dayOfMonth: 1,
    lastLoggedMonth: null,
  },
];

test('computeRecurringSummary calculates committed total and pending bills for target month', () => {
  const stats = computeRecurringSummary(SAMPLE_BILLS, '2026-11');
  assert.equal(stats.totalMonthlyCommitted, 2199);
  assert.equal(stats.loggedCount, 1);
  assert.equal(stats.pendingCount, 1);
  assert.equal(stats.pendingAmount, 1200);
});

test('buildExpenseFromRecurring constructs properly dated expense entry for IRCTC recurring pass', () => {
  const entry = buildExpenseFromRecurring(SAMPLE_BILLS[1], '2026-11');
  assert.equal(entry.merchant, 'IRCTC Monthly Rail Pass');
  assert.equal(entry.amount, 1200);
  assert.equal(entry.date, '2026-11-01');
  assert.equal(entry.appId, 'irctc');
  assert.equal(entry.category, ExpenseCategory.TRANSPORT);
  assert.equal(entry.mode, PaymentMode.ONLINE);
  assert.equal(formatAppLabel('irctc'), 'IRCTC');
});

test('computeSafeDailyLimit divides remaining budget across remaining days in current month', () => {
  const nov20 = new Date(2026, 10, 20); // Nov 20, 2026 (30 days in Nov -> 11 days remaining inclusive)
  const result = computeSafeDailyLimit(11000, '2026-11', nov20);
  assert.equal(result.daysRemaining, 11);
  assert.equal(result.safePerDay, 1000);

  const overBudget = computeSafeDailyLimit(-500, '2026-11', nov20);
  assert.equal(overBudget.safePerDay, 0);
});
