import { type ChangeEvent } from 'react';
import { Download, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import {
  type AppId,
  type ConnectedApp,
  ExpenseCategory,
  type ExpenseEntry,
  type ExpenseFilters,
  PaymentMode,
} from '../types/expense';
import { formatAppLabel, formatINR } from '../utils/analytics';
import { AppBrandIcon } from './AppBrandIcon';

interface TransactionsViewProps {
  expenses: ExpenseEntry[];
  apps: ConnectedApp[];
  filters: ExpenseFilters;
  onUpdateFilters: (next: Partial<ExpenseFilters>) => void;
  onEditExpense: (expense: ExpenseEntry) => void;
  onDeleteExpense: (id: string) => void;
  onOpenAddExpense: () => void;
  onExportCsv: () => void;
  onImportCsvText: (csvText: string) => number;
}

export function TransactionsView({
  expenses,
  apps,
  filters,
  onUpdateFilters,
  onEditExpense,
  onDeleteExpense,
  onOpenAddExpense,
  onExportCsv,
  onImportCsvText,
}: TransactionsViewProps) {
  const totalFiltered = expenses.reduce((sum, item) => sum + item.amount, 0);

  const handleCsvUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    onImportCsvText(text);
    e.target.value = '';
  };

  return (
    <div className="space-y-5">
      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <label htmlFor="ledger-search" className="sr-only">
              Search transactions
            </label>
            <input
              id="ledger-search"
              type="search"
              value={filters.search}
              onChange={(e) => onUpdateFilters({ search: e.target.value })}
              placeholder="Search merchant, item, or notes..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          {/* Mode Segmented Filter */}
          <div
            role="group"
            aria-label="Filter by payment mode"
            className="inline-flex items-center p-1 bg-slate-100 rounded-lg self-start lg:self-auto"
          >
            {(
              [
                { value: 'all', label: 'All Modes' },
                { value: PaymentMode.ONLINE, label: 'Online' },
                { value: PaymentMode.CASH, label: 'Cash' },
              ] as const
            ).map((opt) => {
              const active = filters.mode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onUpdateFilters({ mode: opt.value })}
                  aria-pressed={active}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            {/* App Filter */}
            <div>
              <label htmlFor="filter-app" className="sr-only">
                Filter by application
              </label>
              <select
                id="filter-app"
                value={filters.appId}
                onChange={(e) =>
                  onUpdateFilters({ appId: e.target.value as 'all' | AppId })
                }
                className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              >
                <option value="all">All Apps & Sources</option>
                {apps.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                  </option>
                ))}
                <option value="manual">Manual / Direct Shops</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label htmlFor="filter-category" className="sr-only">
                Filter by category
              </label>
              <select
                id="filter-category"
                value={filters.category}
                onChange={(e) =>
                  onUpdateFilters({
                    category: e.target.value as 'all' | ExpenseCategory,
                  })
                }
                className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              >
                <option value="all">All Categories</option>
                {Object.values(ExpenseCategory).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {(filters.search ||
              filters.mode !== 'all' ||
              filters.appId !== 'all' ||
              filters.category !== 'all') && (
              <button
                type="button"
                onClick={() =>
                  onUpdateFilters({
                    search: '',
                    mode: 'all',
                    appId: 'all',
                    category: 'all',
                  })
                }
                className="text-xs font-medium text-teal-800 hover:text-teal-950"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs text-slate-500 font-mono tabular-nums mr-1">
              {expenses.length} results ·{' '}
              <strong className="text-slate-900">{formatINR(totalFiltered)}</strong>
            </span>
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer">
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Import CSV</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvUpload}
                className="sr-only"
              />
            </label>
            <button
              type="button"
              onClick={onExportCsv}
              disabled={expenses.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {expenses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 px-6">Merchant / Description</th>
                  <th className="py-3 px-4">App / Source</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {expenses.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-6 max-w-[280px]">
                      <p className="font-medium text-slate-900 truncate">
                        {item.merchant}
                      </p>
                      {item.groupSplit && (
                        <p className="text-xs font-medium text-teal-800 truncate mt-0.5">
                          Group split (1/{item.groupSplit.splitCount} of{' '}
                          {formatINR(item.groupSplit.totalBillAmount)})
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {item.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                      <span className="inline-flex items-center gap-2">
                        <AppBrandIcon appId={item.appId} size="sm" />
                        <span>{formatAppLabel(item.appId, apps)}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
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
                    <td className="py-3 px-4 whitespace-nowrap text-xs font-mono tabular-nums text-slate-500">
                      {item.date} · {item.time}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right font-semibold font-mono tabular-nums text-slate-900">
                      {formatINR(item.amount)}
                    </td>
                    <td className="py-3 px-6 whitespace-nowrap text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onEditExpense(item)}
                          aria-label={`Edit or split '${item.merchant}'`}
                          title="Edit or split group order"
                          className="p-1.5 text-slate-400 hover:text-teal-800 hover:bg-teal-50 rounded-md transition-colors"
                        >
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteExpense(item.id)}
                          aria-label={`Delete expense '${item.merchant}'`}
                          className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-14 px-6 text-center">
            <p className="text-sm font-semibold text-slate-900">
              No matching expenditures found
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Try adjusting your search query or filters, or log a new cash/online entry.
            </p>
            <button
              type="button"
              onClick={onOpenAddExpense}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Add Manual Expense</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
