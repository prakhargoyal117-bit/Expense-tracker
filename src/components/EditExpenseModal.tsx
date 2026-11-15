import { useEffect, useState, type FormEvent } from 'react';
import { Users, X } from 'lucide-react';
import {
  type AppId,
  type ConnectedApp,
  ExpenseCategory,
  type ExpenseEntry,
  type GroupOrderSplit,
  PaymentMode,
  type ValidationErrors,
} from '../types/expense';
import { formatINR, validateManualExpense } from '../utils/analytics';
import { computeGroupOrderSplit } from '../utils/reminders';

interface EditExpenseModalProps {
  expense: ExpenseEntry | null;
  apps: ConnectedApp[];
  onClose: () => void;
  onSaveExpense: (updated: ExpenseEntry) => void;
}

export function EditExpenseModal({
  expense,
  apps,
  onClose,
  onSaveExpense,
}: EditExpenseModalProps) {
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('12:00');
  const [mode, setMode] = useState<PaymentMode>(PaymentMode.ONLINE);
  const [category, setCategory] = useState<ExpenseCategory>(ExpenseCategory.FOOD);
  const [appId, setAppId] = useState<AppId>('manual');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});

  // Group order split state
  const [isGroupSplit, setIsGroupSplit] = useState(false);
  const [totalBillInput, setTotalBillInput] = useState('');
  const [splitCountInput, setSplitCountInput] = useState('2');

  useEffect(() => {
    if (!expense) return;
    setMerchant(expense.merchant);
    setAmount(String(expense.amount));
    setDate(expense.date);
    setTime(expense.time);
    setMode(expense.mode);
    setCategory(expense.category);
    setAppId(expense.appId);
    setNotes(expense.notes ?? '');
    setErrors({});

    if (expense.groupSplit) {
      setIsGroupSplit(true);
      setTotalBillInput(String(expense.groupSplit.totalBillAmount));
      setSplitCountInput(String(expense.groupSplit.splitCount));
    } else {
      setIsGroupSplit(false);
      setTotalBillInput(String(expense.amount));
      setSplitCountInput('2');
    }
  }, [expense]);

  if (!expense) return null;

  const applyGroupSplit = (billVal: number, countVal: number) => {
    if (!Number.isFinite(billVal) || billVal <= 0) return;
    const split = computeGroupOrderSplit(billVal, countVal);
    setAmount(String(split.yourShare));
    setErrors((p) => ({ ...p, amount: undefined }));
  };

  const handleToggleGroupSplit = (checked: boolean) => {
    setIsGroupSplit(checked);
    if (checked) {
      const bill = Number(totalBillInput) || Number(amount) || expense.amount;
      const count = Number(splitCountInput) || 2;
      setTotalBillInput(String(bill));
      applyGroupSplit(bill, count);
    } else {
      const fullBill = Number(totalBillInput);
      if (Number.isFinite(fullBill) && fullBill > 0) {
        setAmount(String(Math.round(fullBill)));
      }
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const validationErrors = validateManualExpense({
      merchant,
      amount,
      date,
      time,
      mode,
      category,
      appId,
    });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const numericAmount = Math.round(Number(amount));
    const numericBill = Math.round(Number(totalBillInput) || numericAmount);
    const numericCount = Math.max(2, Math.round(Number(splitCountInput) || 2));

    let groupSplit: GroupOrderSplit | undefined;
    if (isGroupSplit && numericBill > 0) {
      groupSplit = {
        totalBillAmount: Math.max(numericBill, numericAmount),
        splitCount: numericCount,
        yourShare: numericAmount,
      };
    }

    onSaveExpense({
      ...expense,
      merchant: merchant.trim(),
      amount: numericAmount,
      date,
      time,
      mode,
      category,
      appId,
      notes: notes.trim() || undefined,
      groupSplit,
    });
    onClose();
  };

  const numericBillPreview = Number(totalBillInput) || 0;
  const numericSharePreview = Number(amount) || 0;
  const groupCoveredAmount = Math.max(0, numericBillPreview - numericSharePreview);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-expense-title"
        className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-[92vh] flex flex-col"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 id="edit-expense-title" className="text-base font-semibold text-slate-900">
              Edit Expense & Group Split
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Adjust details or split a group order so only your share counts toward your budget.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Edit Expense dialog"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="p-6 space-y-4 overflow-y-auto"
        >
          {/* Merchant */}
          <div>
            <label
              htmlFor="edit-expense-merchant"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Merchant or Item Description
            </label>
            <input
              id="edit-expense-merchant"
              type="text"
              value={merchant}
              onChange={(e) => {
                setMerchant(e.target.value);
                if (errors.merchant) setErrors((p) => ({ ...p, merchant: undefined }));
              }}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
            {errors.merchant && (
              <p className="mt-1 text-xs text-red-700" role="alert">
                {errors.merchant}
              </p>
            )}
          </div>

          {/* Group Order Split Section */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isGroupSplit}
                onChange={(e) => handleToggleGroupSplit(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
              />
              <span className="flex-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                  <Users className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  <span>Split for Group Order</span>
                </span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  Paid the full order for friends? Divide equally or set your personal share below.
                </span>
              </span>
            </label>

            {isGroupSplit && (
              <div className="pt-2 border-t border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="edit-total-bill"
                      className="block text-[11px] font-medium text-slate-700 mb-1"
                    >
                      Total Group Bill (INR)
                    </label>
                    <input
                      id="edit-total-bill"
                      type="number"
                      min="1"
                      step="1"
                      value={totalBillInput}
                      onChange={(e) => {
                        setTotalBillInput(e.target.value);
                        applyGroupSplit(Number(e.target.value), Number(splitCountInput) || 2);
                      }}
                      className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-split-count"
                      className="block text-[11px] font-medium text-slate-700 mb-1"
                    >
                      Split Among (People)
                    </label>
                    <input
                      id="edit-split-count"
                      type="number"
                      min="2"
                      max="25"
                      step="1"
                      value={splitCountInput}
                      onChange={(e) => {
                        setSplitCountInput(e.target.value);
                        applyGroupSplit(Number(totalBillInput) || numericSharePreview, Number(e.target.value));
                      }}
                      className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                    />
                  </div>
                </div>

                {/* Quick Split Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 mr-1">Quick split:</span>
                  {[2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setSplitCountInput(String(n));
                        applyGroupSplit(Number(totalBillInput) || numericSharePreview, n);
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                        Number(splitCountInput) === n
                          ? 'bg-teal-700 text-white border-teal-700'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      ÷ {n}
                    </button>
                  ))}
                </div>

                {numericBillPreview > 0 && numericSharePreview > 0 && (
                  <p className="text-xs text-teal-900 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 font-medium">
                    Full bill {formatINR(numericBillPreview)} → Your share{' '}
                    {formatINR(numericSharePreview)}
                    {groupCoveredAmount > 0
                      ? ` (${formatINR(groupCoveredAmount)} covered by friends)`
                      : ''}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Personal Amount & Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="edit-expense-amount"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                {isGroupSplit ? 'Your Share (INR)' : 'Amount (INR)'}
              </label>
              <input
                id="edit-expense-amount"
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (!isGroupSplit) setTotalBillInput(e.target.value);
                  if (errors.amount) setErrors((p) => ({ ...p, amount: undefined }));
                }}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
              {errors.amount && (
                <p className="mt-1 text-xs text-red-700" role="alert">
                  {errors.amount}
                </p>
              )}
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-700 mb-1">
                Payment Mode
              </span>
              <div
                role="group"
                aria-label="Edit payment mode"
                className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg"
              >
                <button
                  type="button"
                  onClick={() => setMode(PaymentMode.ONLINE)}
                  aria-pressed={mode === PaymentMode.ONLINE}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                    mode === PaymentMode.ONLINE
                      ? 'bg-white text-teal-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Online (UPI)
                </button>
                <button
                  type="button"
                  onClick={() => setMode(PaymentMode.CASH)}
                  aria-pressed={mode === PaymentMode.CASH}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                    mode === PaymentMode.CASH
                      ? 'bg-white text-amber-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cash
                </button>
              </div>
            </div>
          </div>

          {/* App & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="edit-expense-app"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                App or Source
              </label>
              <select
                id="edit-expense-app"
                value={appId}
                onChange={(e) => setAppId(e.target.value as AppId)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              >
                <option value="manual">Manual / Direct Shop</option>
                {apps.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="edit-expense-category"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Category
              </label>
              <select
                id="edit-expense-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              >
                {Object.values(ExpenseCategory).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="edit-expense-date"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Date
              </label>
              <input
                id="edit-expense-date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (errors.date) setErrors((p) => ({ ...p, date: undefined }));
                }}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
              {errors.date && (
                <p className="mt-1 text-xs text-red-700" role="alert">
                  {errors.date}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="edit-expense-time"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Time
              </label>
              <input
                id="edit-expense-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="edit-expense-notes"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Notes (Optional)
            </label>
            <input
              id="edit-expense-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Split with hostel friends"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
            >
              Update Encrypted Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
