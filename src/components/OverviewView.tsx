import {
  ArrowUpRight,
  CalendarClock,
  Pencil,
  Plus,
  Receipt,
  ShieldCheck,
  TrainFront,
} from 'lucide-react';
import {
  type AppSpendInsight,
  type CategorySpendInsight,
  type DailySummaryPoint,
  type ExpenseEntry,
  type MonthlySummary,
  PaymentMode,
} from '../types/expense';
import {
  computeSafeDailyLimit,
  formatAppLabel,
  formatINR,
  formatShortDate,
} from '../utils/analytics';
import { AppBrandIcon } from './AppBrandIcon';
import { DailySpendChart } from './DailySpendChart';
import type { NavSection } from './Sidebar';

interface OverviewViewProps {
  summary: MonthlySummary;
  dailySeries: DailySummaryPoint[];
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  appInsights: AppSpendInsight[];
  categoryInsights: CategorySpendInsight[];
  recentExpenses: ExpenseEntry[];
  pendingRecurringCount: number;
  onNavigate: (section: NavSection) => void;
  onOpenAddExpense: (preset?: 'default' | 'irctc') => void;
  onEditExpense: (expense: ExpenseEntry) => void;
  onFilterByApp: (appId: AppSpendInsight['appId']) => void;
}

export function OverviewView({
  summary,
  dailySeries,
  selectedDate,
  onSelectDate,
  appInsights,
  categoryInsights,
  recentExpenses,
  pendingRecurringCount,
  onNavigate,
  onOpenAddExpense,
  onEditExpense,
  onFilterByApp,
}: OverviewViewProps) {
  const selectedDayData =
    dailySeries.find((d) => d.dateStr === selectedDate) ??
    dailySeries[dailySeries.length - 1];

  const { safePerDay, daysRemaining } = computeSafeDailyLimit(
    summary.remainingBudget,
    summary.month,
  );
  const budgetPct = Math.min(100, Math.max(0, summary.budgetUsedPct));
  const isOverBudget = summary.remainingBudget < 0;

  return (
    <div className="space-y-6">
      {/* Quick Actions Strip */}
      <section
        aria-label="Quick Actions"
        className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3"
      >
        <button
          type="button"
          onClick={() => onOpenAddExpense('default')}
          className="flex items-center gap-2.5 sm:gap-3 px-3 py-3 sm:px-4 bg-white border border-slate-200 hover:border-teal-300 hover:bg-teal-50/40 rounded-xl text-left transition-colors group"
        >
          <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center shrink-0">
            <Plus className="w-4 h-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900 group-hover:text-teal-900 truncate">
              Log Expense
            </p>
            <p className="text-[11px] text-slate-500 truncate">Cash, UPI, split</p>
          </div>
        </button>

        <button
          type="button"
          data-testid="quick-irctc-btn"
          onClick={() => onOpenAddExpense('irctc')}
          className="flex items-center gap-2.5 sm:gap-3 px-3 py-3 sm:px-4 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 rounded-xl text-left transition-colors group"
        >
          <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
            <TrainFront className="w-4 h-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900 group-hover:text-blue-900 truncate">
              IRCTC Ticket
            </p>
            <p className="text-[11px] text-slate-500 truncate">PNR &amp; rail fare</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('security')}
          className="flex items-center gap-2.5 sm:gap-3 px-3 py-3 sm:px-4 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl text-left transition-colors group"
        >
          <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
            <Receipt className="w-4 h-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900 truncate">
              Read Receipts
            </p>
            <p className="text-[11px] text-slate-500 truncate">UPI, SMS &amp; CSV</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('profile')}
          className="flex items-center gap-2.5 sm:gap-3 px-3 py-3 sm:px-4 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl text-left transition-colors group"
        >
          <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
            <CalendarClock className="w-4 h-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900 truncate">
              Profile &amp; Bills
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {pendingRecurringCount > 0
                ? `${pendingRecurringCount} due this month`
                : 'Name & recurring'}
            </p>
          </div>
        </button>
      </section>

      {/* 4-Column KPI Strip */}
      <section
        aria-label="Monthly Expenditure Summary"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-500">Total Monthly Spend</p>
              <span
                className={`text-xs font-mono tabular-nums font-semibold ${
                  isOverBudget ? 'text-red-700' : 'text-teal-800'
                }`}
              >
                {budgetPct}%
              </span>
            </div>
            <p
              data-testid="kpi-total-spend"
              className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums"
            >
              {formatINR(summary.totalSpend)}
            </p>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isOverBudget
                    ? 'bg-red-600'
                    : budgetPct > 85
                      ? 'bg-amber-500'
                      : 'bg-teal-700'
                }`}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 tabular-nums">
              {summary.remainingBudget >= 0
                ? `${formatINR(summary.remainingBudget)} left of ${formatINR(summary.monthlyBudget)}`
                : `${formatINR(Math.abs(summary.remainingBudget))} over budget`}
              {' · '}
              {summary.transactionCount} entries
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Safe Daily Allowance</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {formatINR(safePerDay)}
              <span className="text-xs font-normal text-slate-500"> / day</span>
            </p>
          </div>
          <p className="mt-3 text-xs text-slate-500 tabular-nums">
            {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left · Avg{' '}
            {formatINR(summary.dailyAverage)}/day
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Online vs. Cash Split</p>
            <div className="mt-2 flex items-baseline gap-3 font-mono tabular-nums">
              <span
                data-testid="kpi-online-spend"
                className="text-xl font-bold text-teal-800"
              >
                {formatINR(summary.onlineSpend)}
              </span>
              <span className="text-slate-300">/</span>
              <span
                data-testid="kpi-cash-spend"
                className="text-lg font-bold text-amber-800"
              >
                {formatINR(summary.cashSpend)}
              </span>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-teal-700"
                style={{ width: `${summary.onlinePct}%` }}
              />
              <div
                className="h-full bg-amber-500"
                style={{ width: `${summary.cashPct}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 tabular-nums">
              {summary.onlinePct}% Online · {summary.cashPct}% Cash
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Top Spending App</p>
            {summary.topApp ? (
              <div className="mt-2 flex items-center gap-2.5">
                <AppBrandIcon appId={summary.topApp.appId} size="sm" />
                <span className="text-xl font-bold text-slate-900 truncate">
                  {summary.topApp.appName}
                </span>
              </div>
            ) : (
              <p className="mt-2.5 text-sm font-medium text-slate-600">
                No entries yet
              </p>
            )}
          </div>
          {summary.topApp ? (
            <p className="mt-3 text-xs text-slate-500 tabular-nums">
              {formatINR(summary.topApp.totalSpend)} across {summary.topApp.count}{' '}
              {summary.topApp.count === 1 ? 'entry' : 'entries'}
            </p>
          ) : (
            <p className="mt-3 text-xs text-slate-500">
              Log an IRCTC ticket, UPI receipt, or cash spend
            </p>
          )}
        </div>
      </section>

      {/* Main Chart + Selected Day Summary Split */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2">
          <DailySpendChart
            series={dailySeries}
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
          />
        </div>

        {/* Selected Day Summary Card */}
        <section
          aria-label="Selected Day Summary"
          data-testid="selected-day-summary"
          className="bg-white border border-slate-200 rounded-xl p-6"
        >
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Daily Breakdown
              </h2>
              <p className="text-xs text-slate-500 mt-1 tabular-nums">
                {selectedDayData
                  ? formatShortDate(selectedDayData.dateStr)
                  : selectedDate}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenAddExpense('default')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-800 hover:text-teal-950 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Log item</span>
            </button>
          </div>

          {selectedDayData && selectedDayData.transactions.length > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-3 py-4 border-b border-slate-100">
                <div>
                  <p className="text-[11px] text-slate-500">Day Total</p>
                  <p className="text-base font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {formatINR(selectedDayData.totalSpend)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Online</p>
                  <p className="text-base font-semibold font-mono tabular-nums text-teal-800 mt-0.5">
                    {formatINR(selectedDayData.onlineSpend)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Cash</p>
                  <p className="text-base font-semibold font-mono tabular-nums text-amber-800 mt-0.5">
                    {formatINR(selectedDayData.cashSpend)}
                  </p>
                </div>
              </div>

              <ul className="divide-y divide-slate-100 mt-1 max-h-64 overflow-y-auto">
                {selectedDayData.transactions.map((tx) => (
                  <li
                    key={tx.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <AppBrandIcon appId={tx.appId} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {tx.merchant}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {tx.mode === PaymentMode.ONLINE ? 'Online' : 'Cash'} ·{' '}
                          {tx.time} · {tx.category}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold font-mono tabular-nums text-slate-900 shrink-0">
                      {formatINR(tx.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-slate-700">
                No expenses recorded on this day
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Zero spend logged across apps, IRCTC, or cash entries.
              </p>
              <button
                type="button"
                onClick={() => onOpenAddExpense('default')}
                className="mt-4 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
              >
                Add Manual Expense
              </button>
            </div>
          )}
        </section>
      </div>

      {/* App-by-App Spend & Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* App Spend Breakdown */}
        <section
          aria-label="Spend by Connected App"
          className="bg-white border border-slate-200 rounded-xl p-6"
        >
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Spend by Application
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Click any app (IRCTC, EatSure, Zomato, UPI &amp; more) to inspect its ledger.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('insights')}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-800 hover:text-teal-950 whitespace-nowrap shrink-0"
            >
              <span>All insights</span>
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          {appInsights.length > 0 ? (
            <div className="mt-4 space-y-3.5">
              {appInsights.slice(0, 6).map((item) => (
                <button
                  key={item.appId}
                  type="button"
                  onClick={() => onFilterByApp(item.appId)}
                  className="w-full text-left group rounded-lg p-2 -mx-2 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <AppBrandIcon appId={item.appId} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate group-hover:text-teal-800">
                          {item.appName}
                        </p>
                        <p className="text-xs text-slate-500 tabular-nums">
                          {item.count} {item.count === 1 ? 'entry' : 'entries'} · Avg{' '}
                          {formatINR(item.avgOrder)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold font-mono tabular-nums text-slate-900">
                        {formatINR(item.totalSpend)}
                      </p>
                      <p className="text-xs text-slate-500 font-mono tabular-nums">
                        {item.sharePct}% share
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(4, item.sharePct)}%`,
                        backgroundColor: item.accentHex,
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="py-8 text-sm text-slate-500 text-center">
              Log an expense, IRCTC ticket, or paste a payment receipt to view per-app spend.
            </p>
          )}
        </section>

        {/* Category Breakdown & Vault Trust Summary */}
        <div className="space-y-6">
          <section
            aria-label="Category Breakdown"
            className="bg-white border border-slate-200 rounded-xl p-6"
          >
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">
                Category Distribution
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Food, rail &amp; transit, shopping, groceries, and bills share this month.
              </p>
            </div>

            {categoryInsights.length > 0 ? (
              <div className="mt-4 divide-y divide-slate-100">
                {categoryInsights.map((cat) => (
                  <div
                    key={cat.category}
                    className="py-2.5 flex items-center justify-between gap-4 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">
                        {cat.category}
                      </p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        Online {formatINR(cat.onlineSpend)} · Cash{' '}
                        {formatINR(cat.cashSpend)}
                      </p>
                    </div>
                    <div className="text-right shrink-0 font-mono tabular-nums">
                      <span className="font-semibold text-slate-900">
                        {formatINR(cat.totalSpend)}
                      </span>
                      <span className="ml-2 text-xs text-slate-500">
                        {cat.sharePct}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-sm text-slate-500 text-center">
                No category expenses recorded in this period.
              </p>
            )}
          </section>

          {/* Compact Privacy & Sync Action Card */}
          <section
            aria-label="Account Privacy and Permissions"
            className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3 min-w-0">
              <ShieldCheck
                className="w-5 h-5 text-teal-700 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900">
                  AES-256-GCM Encrypted Personal Vault
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Encrypted locally before syncing across Brave, Chrome &amp; mobile.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('security')}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Apps &amp; Sync
            </button>
          </section>
        </div>
      </div>

      {/* Recent Transactions Preview */}
      <section
        aria-label="Recent Expenditures"
        className="bg-white border border-slate-200 rounded-xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Recent Expenditures
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Latest IRCTC bookings, synced receipts, recurring bills, and cash entries.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('transactions')}
            className="inline-flex items-center gap-1 text-xs font-medium text-teal-800 hover:text-teal-950 whitespace-nowrap shrink-0"
          >
            <span>Open full ledger</span>
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        {recentExpenses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-6">Merchant / Item</th>
                  <th className="py-2.5 px-4">App / Source</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Mode</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  <th className="py-2.5 px-6 text-right">Adjust</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {recentExpenses.slice(0, 6).map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3 px-6 font-medium text-slate-900 max-w-[260px]">
                      <p className="truncate">{item.merchant}</p>
                      {item.groupSplit && (
                        <p className="text-[11px] font-medium text-teal-800 truncate mt-0.5">
                          Group split (1/{item.groupSplit.splitCount} of{' '}
                          {formatINR(item.groupSplit.totalBillAmount)})
                        </p>
                      )}
                      {item.notes && !item.groupSplit && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {item.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <AppBrandIcon appId={item.appId} size="sm" />
                        <span>{formatAppLabel(item.appId)}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {item.category}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`text-xs font-medium ${
                          item.mode === PaymentMode.ONLINE
                            ? 'text-teal-800'
                            : 'text-amber-800'
                        }`}
                      >
                        {item.mode === PaymentMode.ONLINE ? 'Online' : 'Cash'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono tabular-nums text-xs whitespace-nowrap">
                      {item.date} · {item.time}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold font-mono tabular-nums text-slate-900 whitespace-nowrap">
                      {formatINR(item.amount)}
                    </td>
                    <td className="py-3 px-6 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onEditExpense(item)}
                        aria-label={`Edit or split '${item.merchant}'`}
                        title="Edit or split group order"
                        className="p-1.5 text-slate-400 hover:text-teal-800 hover:bg-teal-50 rounded-md transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-10 px-6 text-center space-y-3">
            <p className="text-sm text-slate-500">
              No expenditures recorded in this period yet. Log a cash/UPI spend, add an IRCTC ticket, paste payment receipts, or import a CSV statement.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => onOpenAddExpense('default')}
                className="px-3.5 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
              >
                Add Manual Expense
              </button>
              <button
                type="button"
                onClick={() => onOpenAddExpense('irctc')}
                className="px-3.5 py-2 text-xs font-medium text-blue-800 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors"
              >
                Log IRCTC Ticket
              </button>
              <button
                type="button"
                onClick={() => onNavigate('security')}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Paste Receipts or Sync Cloud
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
