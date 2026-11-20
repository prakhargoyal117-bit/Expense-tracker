import { useEffect, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Cloud,
  Lock,
  LogOut,
  Plus,
  PlusCircle,
  Trash2,
  UserCircle2,
  Wallet,
} from 'lucide-react';
import {
  type AppId,
  type ConnectedApp,
  ExpenseCategory,
  PaymentMode,
  type ProfileUpdateInput,
  type RecurringExpense,
} from '../types/expense';
import { formatAppLabel, formatINR, formatMonthLabel } from '../utils/analytics';
import {
  AVATAR_COLOR_SWATCHES,
  PROFILE_ROLE_PRESETS,
  computeRecurringSummary,
} from '../utils/recurring';
import { AppBrandIcon } from './AppBrandIcon';
import { GoogleSignInButton } from './GoogleSignInButton';

interface ProfileViewProps {
  displayName: string;
  profileLabel: string;
  monthlyBudget: number;
  savingsGoal: number;
  avatarColor: string;
  monthlySpend: number;
  selectedMonth: string;
  apps: ConnectedApp[];
  recurringExpenses: RecurringExpense[];
  googleUser: User | null;
  isSigningInGoogle: boolean;
  isRedirectingGoogle: boolean;
  showRedirectFallback: boolean;
  cloudSyncStatus: string | null;
  lastCloudSyncAt: string | null;
  onSaveProfile: (input: ProfileUpdateInput) => void;
  onAddRecurring: (bill: Omit<RecurringExpense, 'id' | 'lastLoggedMonth'>) => void;
  onLogRecurring: (bill: RecurringExpense) => void;
  onDeleteRecurring: (id: string) => void;
  onGoogleBasicSignIn: () => Promise<void>;
  onGoogleBasicRedirectSignIn: () => Promise<void>;
  onCancelGoogleSignIn: () => void;
  onGoogleSignOut: () => Promise<void>;
  onLockVault: () => void;
  onOpenCreateVault: (mode: 'create' | 'import') => void;
}

export function ProfileView({
  displayName,
  profileLabel,
  monthlyBudget,
  savingsGoal,
  avatarColor,
  monthlySpend,
  selectedMonth,
  apps,
  recurringExpenses,
  googleUser,
  isSigningInGoogle,
  isRedirectingGoogle,
  showRedirectFallback,
  cloudSyncStatus,
  lastCloudSyncAt,
  onSaveProfile,
  onAddRecurring,
  onLogRecurring,
  onDeleteRecurring,
  onGoogleBasicSignIn,
  onGoogleBasicRedirectSignIn,
  onCancelGoogleSignIn,
  onGoogleSignOut,
  onLockVault,
  onOpenCreateVault,
}: ProfileViewProps) {
  const [nameInput, setNameInput] = useState(displayName);
  const [labelInput, setLabelInput] = useState(profileLabel);
  const [budgetInput, setBudgetInput] = useState(String(monthlyBudget));
  const [savingsInput, setSavingsInput] = useState(String(savingsGoal));
  const [selectedColor, setSelectedColor] = useState(avatarColor || '#0F766E');
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  // Add recurring bill form
  const [billMerchant, setBillMerchant] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billCategory, setBillCategory] = useState<ExpenseCategory>(ExpenseCategory.OTHER);
  const [billAppId, setBillAppId] = useState<AppId>('upi_payment');
  const [billMode, setBillMode] = useState<PaymentMode>(PaymentMode.ONLINE);
  const [billDay, setBillDay] = useState('5');
  const [billError, setBillError] = useState<string | null>(null);

  useEffect(() => {
    setNameInput(displayName);
    setLabelInput(profileLabel);
    setBudgetInput(String(monthlyBudget));
    setSavingsInput(String(savingsGoal));
    setSelectedColor(avatarColor || '#0F766E');
  }, [displayName, profileLabel, monthlyBudget, savingsGoal, avatarColor]);

  const effectiveMonth =
    selectedMonth === 'all' ? new Date().toISOString().slice(0, 7) : selectedMonth;
  const recurringStats = computeRecurringSummary(recurringExpenses, effectiveMonth);

  const initials =
    nameInput
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'SV';

  const handleProfileSubmit = (e: FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileNotice(null);

    const trimmedName = nameInput.trim();
    if (trimmedName.length < 2) {
      setProfileError('Display name must be at least 2 characters.');
      return;
    }

    const parsedBudget = Number(budgetInput);
    if (!Number.isFinite(parsedBudget) || parsedBudget < 500) {
      setProfileError('Monthly budget must be at least ₹500.');
      return;
    }

    const parsedSavings = Number(savingsInput || 0);
    if (!Number.isFinite(parsedSavings) || parsedSavings < 0) {
      setProfileError('Savings target cannot be negative.');
      return;
    }

    onSaveProfile({
      displayName: trimmedName,
      profileLabel: labelInput.trim() || 'Personal Finance',
      monthlyBudget: Math.round(parsedBudget),
      savingsGoal: Math.round(parsedSavings),
      avatarColor: selectedColor,
    });
    setProfileNotice('Profile & financial targets saved to your encrypted vault.');
    window.setTimeout(() => setProfileNotice(null), 3500);
  };

  const handleAddRecurringSubmit = (e: FormEvent) => {
    e.preventDefault();
    setBillError(null);
    const trimmed = billMerchant.trim();
    const amt = Number(billAmount);
    const day = Number(billDay);

    if (trimmed.length < 2) {
      setBillError('Enter a bill or subscription name.');
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setBillError('Enter a valid monthly amount greater than ₹0.');
      return;
    }
    if (!Number.isFinite(day) || day < 1 || day > 28) {
      setBillError('Due day must be between 1 and 28.');
      return;
    }

    onAddRecurring({
      merchant: trimmed,
      amount: Math.round(amt),
      category: billCategory,
      appId: billAppId,
      mode: billMode,
      dayOfMonth: Math.round(day),
    });

    setBillMerchant('');
    setBillAmount('');
    setBillDay('5');
  };

  const estimatedSavings = Math.max(0, monthlyBudget - monthlySpend);
  const savingsPct =
    savingsGoal > 0 ? Math.min(100, Math.round((estimatedSavings / savingsGoal) * 100)) : 0;

  return (
    <div className="space-y-8">
      {/* Section 1: Personal Profile & Financial Targets */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <section
          aria-label="Personal Profile Settings"
          className="xl:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div className="flex items-center gap-4">
              {googleUser?.photoURL && !avatarError ? (
                <img
                  src={googleUser.photoURL}
                  alt={nameInput || 'Profile'}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                  className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <span
                  className="w-14 h-14 rounded-2xl text-white text-lg font-bold flex items-center justify-center shrink-0 select-none"
                  style={{ backgroundColor: selectedColor }}
                >
                  {initials}
                </span>
              )}
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900 truncate">
                  {nameInput.trim() || 'Personal Vault'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {labelInput.trim() || 'Personal Finance'}
                  {googleUser?.email ? ` · ${googleUser.email}` : ' · Local Encrypted Vault'}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-800 shrink-0">
              <UserCircle2 className="w-4 h-4" aria-hidden="true" />
              <span>Personal Profile</span>
            </span>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="profile-display-name"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Display Name
                </label>
                <input
                  id="profile-display-name"
                  data-testid="profile-name-input"
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-role-label"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Profile Label / Role
                </label>
                <input
                  id="profile-role-label"
                  data-testid="profile-label-input"
                  type="text"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  placeholder="e.g., Personal Finance, Student, Work"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
            </div>

            {/* Quick Role Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium text-slate-500 mr-1">
                Quick labels:
              </span>
              {PROFILE_ROLE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setLabelInput(preset)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                    labelInput === preset
                      ? 'bg-teal-50 text-teal-900 border-teal-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Budget & Savings Target */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label
                  htmlFor="profile-monthly-budget"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Monthly Spend Limit (INR)
                </label>
                <input
                  id="profile-monthly-budget"
                  data-testid="profile-budget-input"
                  type="number"
                  min={500}
                  step={500}
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-savings-goal"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Monthly Savings Target (INR)
                </label>
                <input
                  id="profile-savings-goal"
                  type="number"
                  min={0}
                  step={500}
                  value={savingsInput}
                  onChange={(e) => setSavingsInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
            </div>

            {/* Avatar Accent Swatch */}
            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-700">
                Avatar Accent Color
              </span>
              <div className="flex flex-wrap items-center gap-2.5">
                {AVATAR_COLOR_SWATCHES.map((swatch) => {
                  const active = selectedColor === swatch.hex;
                  return (
                    <button
                      key={swatch.hex}
                      type="button"
                      onClick={() => setSelectedColor(swatch.hex)}
                      aria-label={`Select ${swatch.label} avatar color`}
                      aria-pressed={active}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform ${
                        active ? 'ring-2 ring-offset-2 ring-slate-900 scale-105' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: swatch.hex }}
                    >
                      {active && <Check className="w-4 h-4 text-white" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {profileError && (
              <p role="alert" className="text-xs font-medium text-red-700">
                {profileError}
              </p>
            )}

            {profileNotice && (
              <p
                role="status"
                data-testid="profile-saved-notice"
                className="text-xs font-medium text-teal-900 bg-teal-50 border border-teal-200 rounded-lg px-3.5 py-2.5 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                <span>{profileNotice}</span>
              </p>
            )}

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
              <button
                type="submit"
                data-testid="save-profile-btn"
                className="px-5 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
              >
                Save Profile Changes
              </button>
            </div>
          </form>
        </section>

        {/* Right Column: Account Sync & Savings Snapshot */}
        <div className="space-y-6">
          {/* Universal Google Account Card */}
          <section
            aria-label="Google Account & Cross-Browser Sync"
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800 shrink-0">
                <Cloud className="w-4 h-4" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Google Account &amp; Cloud Sync
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Open to all Google users—syncs your encrypted vault across Brave, Chrome &amp; mobile.
                </p>
              </div>
            </div>

            {cloudSyncStatus && (
              <p
                role="status"
                className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
              >
                {cloudSyncStatus}
              </p>
            )}

            {googleUser ? (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-slate-900 truncate">
                    {googleUser.displayName || displayName}
                  </p>
                  <p className="text-slate-500 truncate">{googleUser.email}</p>
                  {lastCloudSyncAt && (
                    <p className="text-[11px] font-mono tabular-nums text-teal-800">
                      Last synced {new Date(lastCloudSyncAt).toLocaleTimeString()}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void onGoogleSignOut()}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Sign Out of Google</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <GoogleSignInButton
                  disabled={isSigningInGoogle || isRedirectingGoogle}
                  onClick={() => void onGoogleBasicSignIn()}
                  label={
                    isRedirectingGoogle
                      ? 'Redirecting to Google...'
                      : isSigningInGoogle
                        ? 'Opening Google Sign-In...'
                        : 'Sign in with Google'
                  }
                />
                {showRedirectFallback && (
                  <button
                    type="button"
                    disabled={isRedirectingGoogle}
                    onClick={() => void onGoogleBasicRedirectSignIn()}
                    className="w-full px-3 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    Try Full-Page Redirect Sign-In
                  </button>
                )}
                {isSigningInGoogle && (
                  <button
                    type="button"
                    onClick={onCancelGoogleSignIn}
                    className="w-full px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
                  >
                    Cancel Sign-In
                  </button>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onOpenCreateVault('create')}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-teal-900 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>New Vault</span>
              </button>
              <button
                type="button"
                onClick={onLockVault}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Lock Vault</span>
              </button>
            </div>
          </section>

          {/* Savings Target Progress */}
          <section
            aria-label="Monthly Savings Target"
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Wallet className="w-4 h-4 text-teal-700" aria-hidden="true" />
                <span>Monthly Cushion</span>
              </span>
              <span className="text-xs font-mono tabular-nums font-semibold text-teal-800">
                {savingsGoal > 0 ? `${savingsPct}% of goal` : 'No target set'}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-700 rounded-full transition-all"
                style={{ width: `${savingsGoal > 0 ? savingsPct : 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-500">
              <span>Unspent: {formatINR(estimatedSavings)}</span>
              <span>Goal: {formatINR(savingsGoal)}</span>
            </div>
          </section>
        </div>
      </div>

      {/* Section 2: Recurring Monthly Bills & Subscriptions */}
      <section
        aria-label="Recurring Monthly Bills"
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
              <CalendarClock className="w-4 h-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Recurring Bills &amp; Monthly Subscriptions
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Track rent, Wi-Fi, mobile recharges, OTT plans, or commuter/IRCTC passes and log them in one tap every month.
              </p>
            </div>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-600 shrink-0">
            Total fixed:{' '}
            <strong className="text-slate-900">
              {formatINR(recurringStats.totalMonthlyCommitted)}
            </strong>
            {' · '}
            {recurringStats.loggedCount}/{recurringExpenses.length} logged in{' '}
            {formatMonthLabel(effectiveMonth)}
          </div>
        </div>

        {/* Add Recurring Form */}
        <form
          onSubmit={handleAddRecurringSubmit}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end bg-slate-50 border border-slate-200/90 rounded-xl p-4"
        >
          <div className="lg:col-span-2">
            <label
              htmlFor="rec-merchant"
              className="block text-[11px] font-medium text-slate-700 mb-1"
            >
              Bill / Subscription Name
            </label>
            <input
              id="rec-merchant"
              data-testid="recurring-name-input"
              type="text"
              value={billMerchant}
              onChange={(e) => setBillMerchant(e.target.value)}
              placeholder="e.g., Jio Fiber Wi-Fi, Hostel Rent, IRCTC Pass"
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div>
            <label
              htmlFor="rec-amount"
              className="block text-[11px] font-medium text-slate-700 mb-1"
            >
              Amount (INR)
            </label>
            <input
              id="rec-amount"
              data-testid="recurring-amount-input"
              type="number"
              min="1"
              value={billAmount}
              onChange={(e) => setBillAmount(e.target.value)}
              placeholder="999"
              className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div>
            <label
              htmlFor="rec-category"
              className="block text-[11px] font-medium text-slate-700 mb-1"
            >
              Category
            </label>
            <select
              id="rec-category"
              value={billCategory}
              onChange={(e) => setBillCategory(e.target.value as ExpenseCategory)}
              className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              {Object.values(ExpenseCategory).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="rec-app"
                className="block text-[11px] font-medium text-slate-700 mb-1"
              >
                App
              </label>
              <select
                id="rec-app"
                value={billAppId}
                onChange={(e) => setBillAppId(e.target.value as AppId)}
                className="w-full px-2 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              >
                <option value="upi_payment">UPI</option>
                <option value="manual">Manual</option>
                {apps
                  .filter((a) => a.id !== 'upi_payment')
                  .map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="rec-day"
                className="block text-[11px] font-medium text-slate-700 mb-1"
              >
                Due Day
              </label>
              <input
                id="rec-day"
                type="number"
                min="1"
                max="28"
                value={billDay}
                onChange={(e) => setBillDay(e.target.value)}
                className="w-full px-2 py-2 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Recurring payment mode"
              value={billMode}
              onChange={(e) => setBillMode(e.target.value as PaymentMode)}
              className="px-2 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              <option value={PaymentMode.ONLINE}>Online</option>
              <option value={PaymentMode.CASH}>Cash</option>
            </select>
            <button
              type="submit"
              data-testid="add-recurring-btn"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add</span>
            </button>
          </div>
        </form>

        {billError && (
          <p role="alert" className="text-xs font-medium text-red-700">
            {billError}
          </p>
        )}

        {/* Recurring List */}
        {recurringExpenses.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {recurringExpenses.map((bill) => {
              const isLogged = bill.lastLoggedMonth === effectiveMonth;
              return (
                <div
                  key={bill.id}
                  data-testid={`recurring-row-${bill.id}`}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <AppBrandIcon appId={bill.appId} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {bill.merchant}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {bill.category} · {formatAppLabel(bill.appId, apps)} · Due day{' '}
                        {bill.dayOfMonth} ·{' '}
                        {bill.mode === PaymentMode.ONLINE ? 'Online' : 'Cash'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <span className="text-sm font-semibold font-mono tabular-nums text-slate-900">
                      {formatINR(bill.amount)}
                    </span>

                    {isLogged ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800">
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Logged</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onLogRecurring(bill)}
                        className="px-3 py-1.5 text-xs font-medium text-teal-900 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap"
                      >
                        Log for This Month
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDeleteRecurring(bill.id)}
                      aria-label={`Delete recurring bill '${bill.merchant}'`}
                      className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-500">
            No recurring monthly bills saved yet. Add fixed monthly spends like rent, Wi-Fi, mobile plans, or travel passes above to log them in one tap each month.
          </div>
        )}
      </section>
    </div>
  );
}
