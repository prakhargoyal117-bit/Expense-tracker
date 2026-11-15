import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAppInsights,
  computeDailySeries,
  computeMonthlySummary,
  filterExpenses,
  generateExpensesCsv,
  validateManualExpense,
} from './analytics';
import { INITIAL_APPS, INITIAL_EXPENSES } from '../data/seedData';
import { ExpenseCategory, PaymentMode } from '../types/expense';

test('computeMonthlySummary totals match sum of online and cash spend', () => {
  const summary = computeMonthlySummary(
    INITIAL_EXPENSES,
    INITIAL_APPS,
    '2026-11',
    12000,
    15,
  );

  assert.equal(summary.onlineSpend + summary.cashSpend, summary.totalSpend);
  assert.equal(summary.onlinePct + summary.cashPct, 100);
  assert.ok(summary.totalSpend > 0);
  assert.ok(summary.topApp !== null);
  assert.equal(summary.remainingBudget, 12000 - summary.totalSpend);
});

test('computeDailySeries covers all days in month and sums cleanly to monthly total', () => {
  const series = computeDailySeries(INITIAL_EXPENSES, INITIAL_APPS, '2026-11');
  assert.equal(series.length, 30);

  const seriesTotal = series.reduce((sum, day) => sum + day.totalSpend, 0);
  const summary = computeMonthlySummary(
    INITIAL_EXPENSES,
    INITIAL_APPS,
    '2026-11',
    12000,
  );
  assert.equal(seriesTotal, summary.totalSpend);

  const nov15 = series.find((d) => d.dateStr === '2026-11-15');
  assert.ok(nov15);
  assert.equal(nov15.count, 2);
  assert.equal(nov15.onlineSpend, 349);
  assert.equal(nov15.cashSpend, 95);
});

test('computeAppInsights ranks apps by spend and tracks online vs cash per app', () => {
  const insights = computeAppInsights(INITIAL_EXPENSES, INITIAL_APPS, '2026-11');
  assert.ok(insights.length >= 4);

  for (let i = 1; i < insights.length; i += 1) {
    assert.ok(insights[i - 1].totalSpend >= insights[i].totalSpend);
  }

  const amazon = insights.find((a) => a.appId === 'amazon');
  assert.ok(amazon);
  assert.equal(amazon.onlineSpend + amazon.cashSpend, amazon.totalSpend);
  assert.ok(amazon.cashSpend > 0); // includes COD textbook
});

test('filterExpenses supports mode, appId, month, and search query', () => {
  const cashOnly = filterExpenses(INITIAL_EXPENSES, {
    month: '2026-11',
    search: '',
    mode: PaymentMode.CASH,
    appId: 'all',
    category: 'all',
  });
  assert.ok(cashOnly.length > 0);
  assert.ok(cashOnly.every((e) => e.mode === PaymentMode.CASH));

  const zomatoSearch = filterExpenses(INITIAL_EXPENSES, {
    month: '2026-11',
    search: 'biryani',
    mode: 'all',
    appId: 'zomato',
    category: 'all',
  });
  assert.equal(zomatoSearch.length, 1);
  assert.equal(zomatoSearch[0].amount, 349);
});

test('validateManualExpense rejects invalid fields and accepts valid entry', () => {
  const invalid = validateManualExpense({
    merchant: ' ',
    amount: '-50',
    date: 'bad-date',
    time: '12:00',
    mode: PaymentMode.CASH,
    category: ExpenseCategory.FOOD,
    appId: 'manual',
  });
  assert.ok(invalid.merchant);
  assert.ok(invalid.amount);
  assert.ok(invalid.date);

  const valid = validateManualExpense({
    merchant: 'Campus Bookstore',
    amount: '450',
    date: '2026-11-15',
    time: '14:30',
    mode: PaymentMode.CASH,
    category: ExpenseCategory.ACADEMICS,
    appId: 'manual',
  });
  assert.deepEqual(valid, {});
});

test('generateExpensesCsv outputs properly escaped header and rows', () => {
  const csv = generateExpensesCsv(INITIAL_EXPENSES.slice(0, 2), INITIAL_APPS);
  const lines = csv.split('\n');
  assert.equal(lines.length, 3);
  assert.ok(lines[0].startsWith('Date,Time,Merchant'));
});
