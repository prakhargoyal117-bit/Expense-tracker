import { useEffect, useState, type FormEvent } from 'react';
import { Users, X } from 'lucide-react';
import {
  type AppId,
  type ConnectedApp,
  ExpenseCategory,
  type GroupOrderSplit,
  type ManualExpenseInput,
  PaymentMode,
  type ValidationErrors,
} from '../types/expense';
import { TODAY_DATE } from '../data/seedData';
import { formatINR, validateManualExpense } from '../utils/analytics';
import { computeGroupOrderSplit } from '../utils/reminders';

interface AddExpenseModalProps {
  isOpen: boolean;
  apps: ConnectedApp[];
  defaultDate?: string;
  onClose: () => void;
  onSubmitExpense: (input: ManualExpenseInput) => void;
}

export function AddExpenseModal({
  isOpen,
  apps,
  defaultDate,
  onClose,
  onSubmitExpense,
}: AddExpenseModalProps) {
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(defaultDate || TODAY_DATE);
  const [time, setTime] = useState('14:00');
  const [mode, setMode] = useState<PaymentMode>(PaymentMode.CASH);
  const [category, setCategory] = useState<ExpenseCategory>(ExpenseCategory.FOOD);
  const [appId, setAppId] = useState<AppId>('manual');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isGroupSplit, setIsGroupSplit] = useState(false);
  const [totalBillInput, setTotalBillInput] = useState('');
  const [splitCountInput, setSplitCountInput] = useState('2');

  useEffect(() => {
    if (isOpen) {
      setDate(defaultDate || TODAY_DATE);
      setErrors({});
    }
  }, [isOpen, defaultDate]);

  if (!isOpen) return null;

  const sortedApps = [...apps].sort((a, b) => Number(b.isConnected) - Number(a.isConnected));

  const applySplit = (billVal: number, countVal: number) => {
    if (!Number.isFinite(billVal) || billVal <= 0) return;
    const split = computeGroupOrderSplit(billVal, countVal);
    setAmount(String(split.yourShare));
    setErrors((p) => ({ ...p, amount: undefined }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    let groupSplit: GroupOrderSplit | undefined;
    if (isGroupSplit) {
      const share = Math.round(Number(amount));
      const bill = Math.round(Number(totalBillInput) || share);
      const count = Math.max(2, Math.round(Number(splitCountInput) || 2));
      if (bill > 0 && share > 0) {
        groupSplit = {
          totalBillAmount: Math.max(bill, share),
          splitCount: count,
          yourShare: share,
        };
      }
    }

    const payload: ManualExpenseInput = {
      merchant,
      amount,
      date,
      time,
      mode,
      category,
      appId,
      notes: notes.trim() || undefined,
      groupSplit,
    };

    const nextErrors = validateManualExpense(payload);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSubmitExpense(payload);
    setMerchant('');
    setAmount('');
    setNotes('');
    setIsGroupSplit(false);
    setTotalBillInput('');
    setSplitCountInput('2');
    setErrors({});
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-expense-title"
        className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 id="add-expense-title" className="text-base font-semibold text-slate-900">
              Add Manual Expenditure
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Encrypted locally with AES-256-GCM before saving to your vault.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Add Expense dialog"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Merchant */}
          <div>
            <label
              htmlFor="expense-merchant"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Merchant or Item Description
            </label>
            <input
              id="expense-merchant"
              type="text"
              value={merchant}
              onChange={(e) => {
                setMerchant(e.target.value);
                if (errors.merchant) setErrors((p) => ({ ...p, merchant: undefined }));
              }}
              placeholder="e.g., Campus Bookstore, Chai Stall, Zomato Order"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
            {errors.merchant && (
              <p className="mt-1 text-xs text-red-700" role="alert">
                {errors.merchant}
              </p>
            )}
          </div>

          {/* Amount & Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="expense-amount"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Amount (INR)
              </label>
              <input
                id="expense-amount"
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (errors.amount) setErrors((p) => ({ ...p, amount: undefined }));
                }}
                placeholder="450"
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
                aria-label="Payment Mode"
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

          {/* App / Source & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="expense-app"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                App or Source
              </label>
              <select
                id="expense-app"
                value={appId}
                onChange={(e) => setAppId(e.target.value as AppId)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              >
                <option value="manual">Manual / Direct Shop</option>
                {sortedApps.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="expense-category"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Category
              </label>
              <select
                id="expense-category"
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
                htmlFor="expense-date"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Date
              </label>
              <input
                id="expense-date"
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
                htmlFor="expense-time"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Time
              </label>
              <input
                id="expense-time"
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
              htmlFor="expense-notes"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Notes (Optional)
            </label>
            <input
              id="expense-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Split with hostel roommate"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          {/* Optional Group Order Split */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isGroupSplit}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsGroupSplit(checked);
                  if (checked) {
                    const initialBill = Number(totalBillInput) || Number(amount) || 0;
                    if (initialBill > 0) {
                      setTotalBillInput(String(initialBill));
                      applySplit(initialBill, Number(splitCountInput) || 2);
                    }
                  } else if (Number(totalBillInput) > 0) {
                    setAmount(totalBillInput);
                  }
                }}
                className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
              />
              <span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                  <Users className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  <span>Group Order (Split Among Friends)</span>
                </span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  Automatically calculates your personal share from the total bill.
                </span>
              </span>
            </label>

            {isGroupSplit && (
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="add-total-bill"
                      className="block text-[11px] font-medium text-slate-700 mb-1"
                    >
                      Total Group Bill (INR)
                    </label>
                    <input
                      id="add-total-bill"
                      type="number"
                      min="1"
                      step="1"
                      value={totalBillInput}
                      onChange={(e) => {
                        setTotalBillInput(e.target.value);
                        applySplit(Number(e.target.value), Number(splitCountInput) || 2);
                      }}
                      placeholder="1200"
                      className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="add-split-count"
                      className="block text-[11px] font-medium text-slate-700 mb-1"
                    >
                      People in Group
                    </label>
                    <input
                      id="add-split-count"
                      type="number"
                      min="2"
                      max="25"
                      step="1"
                      value={splitCountInput}
                      onChange={(e) => {
                        setSplitCountInput(e.target.value);
                        applySplit(Number(totalBillInput) || Number(amount), Number(e.target.value));
                      }}
                      className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                    />
                  </div>
                </div>
                {Number(totalBillInput) > 0 && Number(amount) > 0 && (
                  <p className="text-[11px] font-medium text-teal-800">
                    Recording your share as {formatINR(Number(amount))} out of{' '}
                    {formatINR(Number(totalBillInput))} total bill.
                  </p>
                )}
              </div>
            )}
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
              Save Encrypted Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
