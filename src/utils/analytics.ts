import {
  type AppId,
  type AppSpendInsight,
  type CategorySpendInsight,
  type ConnectedApp,
  type DailySummaryPoint,
  ExpenseCategory,
  type ExpenseEntry,
  type ExpenseFilters,
  type ManualExpenseInput,
  type MonthlySummary,
  PaymentMode,
  type ValidationErrors,
} from '../types/expense';

export function formatAppLabel(appId: AppId, apps?: ConnectedApp[]): string {
  if (appId === 'manual') return 'Manual';
  if (appId === 'irctc') return 'IRCTC';
  if (appId === 'upi_payment') return 'Online Payment Apps';
  if (appId === 'eatsure') return 'EatSure';
  if (appId === 'bookmyshow') return 'BookMyShow';
  const found = apps?.find((a) => a.id === appId);
  if (found) return found.name;
  return appId.charAt(0).toUpperCase() + appId.slice(1);
}

export function formatINR(amount: number): string {
  const rounded = Math.round(amount);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rounded);
}

export function formatMonthLabel(monthKey: string): string {
  if (monthKey === 'all') return 'All Months';
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return monthKey;
  const date = new Date(year, monthIndex, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatShortDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getDaysInMonth(monthKey: string): number {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return 30;
  }
  return new Date(year, month, 0).getDate();
}

export function getAvailableMonths(expenses: ExpenseEntry[]): string[] {
  const set = new Set<string>();
  for (const item of expenses) {
    const month = item.date.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(month)) {
      set.add(month);
    }
  }
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

export function filterExpenses(
  expenses: ExpenseEntry[],
  filters: ExpenseFilters,
): ExpenseEntry[] {
  const query = filters.search.trim().toLowerCase();

  return expenses
    .filter((entry) => {
      if (filters.month !== 'all' && !entry.date.startsWith(filters.month)) {
        return false;
      }
      if (filters.mode !== 'all' && entry.mode !== filters.mode) {
        return false;
      }
      if (filters.appId !== 'all' && entry.appId !== filters.appId) {
        return false;
      }
      if (filters.category !== 'all' && entry.category !== filters.category) {
        return false;
      }
      if (query) {
        const haystack = `${entry.merchant} ${entry.category} ${entry.appId} ${entry.notes ?? ''}`.toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return b.time.localeCompare(a.time);
    });
}

export function computeMonthlySummary(
  expenses: ExpenseEntry[],
  apps: ConnectedApp[],
  month: string,
  monthlyBudget: number,
  referenceDayCount?: number,
): MonthlySummary {
  const scoped =
    month === 'all'
      ? expenses
      : expenses.filter((entry) => entry.date.startsWith(month));

  let totalSpend = 0;
  let onlineSpend = 0;
  let cashSpend = 0;

  const appTotals = new Map<AppId, { total: number; count: number }>();

  for (const item of scoped) {
    totalSpend += item.amount;
    if (item.mode === PaymentMode.ONLINE) {
      onlineSpend += item.amount;
    } else {
      cashSpend += item.amount;
    }
    const prev = appTotals.get(item.appId) ?? { total: 0, count: 0 };
    appTotals.set(item.appId, {
      total: prev.total + item.amount,
      count: prev.count + 1,
    });
  }

  const onlinePct = totalSpend > 0 ? Math.round((onlineSpend / totalSpend) * 100) : 0;
  const cashPct = totalSpend > 0 ? 100 - onlinePct : 0;

  const budgetUsedPct =
    monthlyBudget > 0 ? Math.round((totalSpend / monthlyBudget) * 100) : 0;

  const activeDays =
    referenceDayCount && referenceDayCount > 0
      ? referenceDayCount
      : Math.max(1, new Set(scoped.map((e) => e.date)).size);

  const dailyAverage = totalSpend > 0 ? Math.round(totalSpend / activeDays) : 0;

  let topApp: MonthlySummary['topApp'] = null;
  for (const [appId, stats] of appTotals.entries()) {
    if (!topApp || stats.total > topApp.totalSpend) {
      const appMeta = apps.find((a) => a.id === appId);
      topApp = {
        appId,
        appName: appMeta?.name ?? (appId === 'manual' ? 'Manual / Cash' : appId),
        totalSpend: stats.total,
        count: stats.count,
      };
    }
  }

  return {
    month,
    totalSpend,
    onlineSpend,
    cashSpend,
    onlinePct,
    cashPct,
    transactionCount: scoped.length,
    monthlyBudget,
    remainingBudget: monthlyBudget - totalSpend,
    budgetUsedPct,
    dailyAverage,
    topApp,
  };
}

export function computeDailySeries(
  expenses: ExpenseEntry[],
  apps: ConnectedApp[],
  month: string,
): DailySummaryPoint[] {
  const daysCount = getDaysInMonth(month);
  const byDay = new Map<number, ExpenseEntry[]>();

  for (const item of expenses) {
    if (!item.date.startsWith(month)) continue;
    const dayNum = Number(item.date.slice(8, 10));
    if (!Number.isFinite(dayNum) || dayNum < 1 || dayNum > daysCount) continue;
    const existing = byDay.get(dayNum) ?? [];
    existing.push(item);
    byDay.set(dayNum, existing);
  }

  const appNameMap = new Map<AppId, string>(apps.map((a) => [a.id, a.name]));
  appNameMap.set('manual', 'Manual / Direct');

  const series: DailySummaryPoint[] = [];

  for (let day = 1; day <= daysCount; day += 1) {
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${month}-${dayStr}`;
    const transactions = (byDay.get(day) ?? []).sort((a, b) =>
      b.time.localeCompare(a.time),
    );

    let onlineSpend = 0;
    let cashSpend = 0;
    const appSpend = new Map<AppId, number>();

    for (const tx of transactions) {
      if (tx.mode === PaymentMode.ONLINE) {
        onlineSpend += tx.amount;
      } else {
        cashSpend += tx.amount;
      }
      appSpend.set(tx.appId, (appSpend.get(tx.appId) ?? 0) + tx.amount);
    }

    let topAppId: AppId | null = null;
    let topAppAmount = -1;
    for (const [id, amt] of appSpend.entries()) {
      if (amt > topAppAmount) {
        topAppAmount = amt;
        topAppId = id;
      }
    }

    series.push({
      day,
      dateStr,
      label: `${day}`,
      onlineSpend,
      cashSpend,
      totalSpend: onlineSpend + cashSpend,
      count: transactions.length,
      topAppName: topAppId ? (appNameMap.get(topAppId) ?? topAppId) : null,
      transactions,
    });
  }

  return series;
}

export function computeAppInsights(
  expenses: ExpenseEntry[],
  apps: ConnectedApp[],
  month: string,
): AppSpendInsight[] {
  const scoped =
    month === 'all'
      ? expenses
      : expenses.filter((entry) => entry.date.startsWith(month));

  const totalMonthSpend = scoped.reduce((acc, item) => acc + item.amount, 0);

  const grouped = new Map<
    AppId,
    { total: number; online: number; cash: number; count: number }
  >();

  for (const item of scoped) {
    const curr = grouped.get(item.appId) ?? {
      total: 0,
      online: 0,
      cash: 0,
      count: 0,
    };
    curr.total += item.amount;
    if (item.mode === PaymentMode.ONLINE) {
      curr.online += item.amount;
    } else {
      curr.cash += item.amount;
    }
    curr.count += 1;
    grouped.set(item.appId, curr);
  }

  const insights: AppSpendInsight[] = [];

  for (const app of apps) {
    const stats = grouped.get(app.id);
    if (!stats && !app.isConnected) continue;
    const total = stats?.total ?? 0;
    const count = stats?.count ?? 0;
    insights.push({
      appId: app.id,
      appName: app.name,
      category: app.category,
      accentHex: app.accentHex,
      isConnected: app.isConnected,
      totalSpend: total,
      onlineSpend: stats?.online ?? 0,
      cashSpend: stats?.cash ?? 0,
      count,
      avgOrder: count > 0 ? Math.round(total / count) : 0,
      sharePct: totalMonthSpend > 0 ? Math.round((total / totalMonthSpend) * 100) : 0,
    });
  }

  const manualStats = grouped.get('manual');
  if (manualStats) {
    insights.push({
      appId: 'manual',
      appName: 'Manual / Direct Shops',
      category: ExpenseCategory.OTHER,
      accentHex: '#475569',
      isConnected: true,
      totalSpend: manualStats.total,
      onlineSpend: manualStats.online,
      cashSpend: manualStats.cash,
      count: manualStats.count,
      avgOrder: Math.round(manualStats.total / manualStats.count),
      sharePct:
        totalMonthSpend > 0
          ? Math.round((manualStats.total / totalMonthSpend) * 100)
          : 0,
    });
  }

  return insights.sort((a, b) => b.totalSpend - a.totalSpend);
}

export function computeCategoryBreakdown(
  expenses: ExpenseEntry[],
  month: string,
): CategorySpendInsight[] {
  const scoped =
    month === 'all'
      ? expenses
      : expenses.filter((entry) => entry.date.startsWith(month));

  const totalMonthSpend = scoped.reduce((acc, item) => acc + item.amount, 0);
  const grouped = new Map<
    ExpenseCategory,
    { total: number; online: number; cash: number; count: number }
  >();

  for (const item of scoped) {
    const curr = grouped.get(item.category) ?? {
      total: 0,
      online: 0,
      cash: 0,
      count: 0,
    };
    curr.total += item.amount;
    if (item.mode === PaymentMode.ONLINE) {
      curr.online += item.amount;
    } else {
      curr.cash += item.amount;
    }
    curr.count += 1;
    grouped.set(item.category, curr);
  }

  return Array.from(grouped.entries())
    .map(([category, stats]) => ({
      category,
      totalSpend: stats.total,
      onlineSpend: stats.online,
      cashSpend: stats.cash,
      count: stats.count,
      sharePct:
        totalMonthSpend > 0 ? Math.round((stats.total / totalMonthSpend) * 100) : 0,
    }))
    .sort((a, b) => b.totalSpend - a.totalSpend);
}

export function validateManualExpense(input: ManualExpenseInput): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!input.merchant.trim()) {
    errors.merchant = 'Enter a merchant or item description.';
  } else if (input.merchant.trim().length < 2) {
    errors.merchant = 'Merchant description must be at least 2 characters.';
  }

  const parsedAmount = Number(input.amount);
  if (!input.amount.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    errors.amount = 'Enter a valid amount greater than ₹0.';
  } else if (parsedAmount > 1_000_000) {
    errors.amount = 'Amount cannot exceed ₹10,00,000.';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    errors.date = 'Select a valid expense date.';
  }

  return errors;
}

export function generateExpensesCsv(
  expenses: ExpenseEntry[],
  apps: ConnectedApp[],
): string {
  const appNameMap = new Map<AppId, string>(apps.map((a) => [a.id, a.name]));
  appNameMap.set('manual', 'Manual / Direct');

  const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;

  const header = [
    'Date',
    'Time',
    'Merchant',
    'App / Source',
    'Category',
    'Payment Mode',
    'Amount (INR)',
    'Entry Type',
    'Notes',
  ].join(',');

  const rows = expenses.map((e) =>
    [
      e.date,
      e.time,
      escapeCsv(e.merchant),
      escapeCsv(appNameMap.get(e.appId) ?? e.appId),
      escapeCsv(e.category),
      e.mode === PaymentMode.ONLINE ? 'Online' : 'Cash',
      String(e.amount),
      e.source === 'app_sync' ? 'App Sync' : 'Manual',
      escapeCsv(e.notes ?? ''),
    ].join(','),
  );

  return [header, ...rows].join('\n');
}

export function computeSafeDailyLimit(
  remainingBudget: number,
  monthKey: string,
  now: Date = new Date(),
): { safePerDay: number; daysRemaining: number } {
  if (monthKey === 'all') {
    return { safePerDay: Math.max(0, Math.round(remainingBudget / 30)), daysRemaining: 30 };
  }
  const totalDays = getDaysInMonth(monthKey);
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const daysRemaining =
    monthKey === currentMonth
      ? Math.max(1, totalDays - now.getDate() + 1)
      : totalDays;
  const safePerDay =
    remainingBudget > 0 ? Math.round(remainingBudget / daysRemaining) : 0;
  return { safePerDay, daysRemaining };
}
