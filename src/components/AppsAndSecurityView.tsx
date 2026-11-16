import { useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Cloud,
  CloudDownload,
  CloudUpload,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  PlusCircle,
  Receipt,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Trash2,
  Unlink,
  Upload,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type {
  AppId,
  ConnectedApp,
  EncryptedVaultEnvelope,
  ReminderPreferences,
} from '../types/expense';
import type { GmailScanScope } from '../services/gmailService';
import { formatINR } from '../utils/analytics';
import { formatTime12h, type NightlySpendSummary } from '../utils/reminders';
import { AppBrandIcon } from './AppBrandIcon';
import { GoogleSignInButton } from './GoogleSignInButton';
import { PWAInstallButton } from './PWAInstallButton';

interface StatusBanner {
  type: 'success' | 'error' | 'info';
  text: string;
}

interface AppsAndSecurityViewProps {
  apps: ConnectedApp[];
  envelope: EncryptedVaultEnvelope | null;
  vaultFingerprint: string;
  monthlyBudget: number;
  googleUser: User | null;
  hasGmailToken: boolean;
  isSigningInGoogle: boolean;
  isRedirectingGoogle: boolean;
  showRedirectFallback: boolean;
  isSyncingGmail: boolean;
  gmailStatus: StatusBanner | null;
  appSyncStatus: StatusBanner | null;
  syncingAppId: AppId | null;
  cloudSyncStatus: string | null;
  lastCloudSyncAt: string | null;
  isCloudBusy: boolean;
  onRequestConnectApp: (app: ConnectedApp) => void;
  onSyncApp: (appId: AppId) => Promise<void>;
  onToggleScope: (appId: AppId, scopeId: string) => void;
  onRevokeApp: (appId: AppId, purgeData: boolean) => void;
  onUpdateBudget: (budget: number) => void;
  onSetPassphrase: (newPassphrase: string) => Promise<void>;
  onLockVault: () => void;
  onExportEncryptedBackup: () => void;
  onResetDemoVault: () => void;
  onOpenCreateVault: (mode: 'create' | 'import') => void;
  onGoogleSignIn: (scanScope?: GmailScanScope) => Promise<void>;
  onGoogleRedirectSignIn: () => Promise<void>;
  onCancelGoogleSignIn: () => void;
  onGoogleSignOut: () => Promise<void>;
  onScanGmailReceipts: (scope: GmailScanScope) => Promise<void>;
  onImportPaymentReceipts: (rawText: string) => {
    imported: number;
    ignored: number;
    totalScanned: number;
  };
  onImportCsvText: (csvText: string) => number;
  onPushCloudVault: () => Promise<void>;
  onPullCloudVault: (passphraseOverride?: string) => Promise<void>;
  onDeleteCloudVault: () => Promise<void>;
  reminderSettings: ReminderPreferences;
  nightlySummary: NightlySpendSummary;
  onEnableNightlyReminders: (enabled: boolean) => Promise<string | null>;
  onUpdateNightlyTime: (nightlyTime: string) => void;
  onSendNightlyPreview: () => Promise<void>;
}

export function AppsAndSecurityView({
  apps,
  envelope,
  vaultFingerprint,
  monthlyBudget,
  googleUser,
  hasGmailToken,
  isSigningInGoogle,
  isRedirectingGoogle,
  showRedirectFallback,
  isSyncingGmail,
  gmailStatus,
  appSyncStatus,
  syncingAppId,
  cloudSyncStatus,
  lastCloudSyncAt,
  isCloudBusy,
  onRequestConnectApp,
  onSyncApp,
  onToggleScope,
  onRevokeApp,
  onUpdateBudget,
  onSetPassphrase,
  onLockVault,
  onExportEncryptedBackup,
  onResetDemoVault,
  onOpenCreateVault,
  onGoogleSignIn,
  onGoogleRedirectSignIn,
  onCancelGoogleSignIn,
  onGoogleSignOut,
  onScanGmailReceipts,
  onImportPaymentReceipts,
  onImportCsvText,
  onPushCloudVault,
  onPullCloudVault,
  onDeleteCloudVault,
  reminderSettings,
  nightlySummary,
  onEnableNightlyReminders,
  onUpdateNightlyTime,
  onSendNightlyPreview,
}: AppsAndSecurityViewProps) {
  const [showCiphertext, setShowCiphertext] = useState(false);
  const [newPassphrase, setNewPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [passphraseMsg, setPassphraseMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isUpdatingPassphrase, setIsUpdatingPassphrase] = useState(false);

  const [budgetInput, setBudgetInput] = useState(String(monthlyBudget));
  const [budgetSaved, setBudgetSaved] = useState(false);

  const [revokingAppId, setRevokingAppId] = useState<AppId | null>(null);
  const [csvNotice, setCsvNotice] = useState<string | null>(null);
  const [gmailScanScope, setGmailScanScope] = useState<GmailScanScope>('all');
  const [paymentReceiptInput, setPaymentReceiptInput] = useState('');
  const [paymentReceiptNotice, setPaymentReceiptNotice] = useState<string | null>(null);

  const [confirmDeleteCloud, setConfirmDeleteCloud] = useState(false);
  const [cloudPullPassphrase, setCloudPullPassphrase] = useState('');
  const [reminderNotice, setReminderNotice] = useState<string | null>(null);

  const connectedApps = apps.filter((a) => a.isConnected);
  const availableApps = apps.filter((a) => !a.isConnected);

  const handlePassphraseSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPassphraseMsg(null);
    if (newPassphrase.trim().length < 6) {
      setPassphraseMsg({
        type: 'error',
        text: 'Passphrase must be at least 6 characters long.',
      });
      return;
    }
    if (newPassphrase !== confirmPassphrase) {
      setPassphraseMsg({
        type: 'error',
        text: 'Passphrases do not match.',
      });
      return;
    }
    setIsUpdatingPassphrase(true);
    try {
      await onSetPassphrase(newPassphrase);
      setNewPassphrase('');
      setConfirmPassphrase('');
      setPassphraseMsg({
        type: 'success',
        text: 'Vault re-encrypted with your new AES-256-GCM passphrase.',
      });
    } catch {
      setPassphraseMsg({
        type: 'error',
        text: 'Could not update passphrase. Please try again.',
      });
    } finally {
      setIsUpdatingPassphrase(false);
    }
  };

  const handleBudgetSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = Number(budgetInput);
    if (!Number.isFinite(parsed) || parsed < 500) return;
    onUpdateBudget(Math.round(parsed));
    setBudgetSaved(true);
    setTimeout(() => setBudgetSaved(false), 2500);
  };

  const handleSync = (app: ConnectedApp) => {
    void onSyncApp(app.id);
  };

  const handleCsvUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const count = onImportCsvText(text);
    setCsvNotice(
      count > 0
        ? `Imported ${count} expenditure rows from ${file.name} into your encrypted vault.`
        : `No valid rows found in ${file.name}. Ensure columns include Date, Merchant, and Amount.`,
    );
    e.target.value = '';
  };

  return (
    <div className="space-y-8">
      {/* Section 1: Real Personal Data Connectors (Gmail Receipt Sync + CSV Import) */}
      <section aria-label="Personal Receipt and Statement Sync" className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Personal Receipt Sync & Statement Import
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Connect your personal Gmail account (read-only) to scan Zomato, Swiggy, EatSure, Amazon, Flipkart, Blinkit, Uber, or any online payment app receipts locally, or paste/import receipts directly.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Gmail Receipt Sync Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800 shrink-0">
                    <Mail className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Gmail Order &amp; Payment-App Scanner
                    </h3>
                    <p className="text-xs text-slate-500">
                      {googleUser
                        ? `Signed in as ${googleUser.email}`
                        : 'Reads only matching order or payment receipt emails'}
                    </p>
                  </div>
                </div>
                {googleUser && (
                  <span className="text-xs font-medium text-teal-800 shrink-0">
                    {hasGmailToken ? 'Gmail Ready' : 'Re-auth needed'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Emails are filtered and parsed inside your browser—OTPs, promos, and non-receipt mails are skipped automatically, and totals are encrypted before saving.
              </p>

              {/* Scan Scope Selector */}
              <div className="space-y-1">
                <span className="block text-[11px] font-medium text-slate-600">
                  Gmail Scan Filter
                </span>
                <div
                  role="group"
                  aria-label="Gmail scan scope"
                  className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg"
                >
                  {(
                    [
                      { value: 'payment_apps', label: 'Payment Apps Only' },
                      { value: 'orders', label: 'Order Apps' },
                      { value: 'all', label: 'All Receipts' },
                    ] as const
                  ).map((opt) => {
                    const active = gmailScanScope === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setGmailScanScope(opt.value)}
                        aria-pressed={active}
                        className={`px-2 py-1.5 text-[11px] font-medium rounded-md transition-colors ${
                          active
                            ? 'bg-white text-teal-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {gmailStatus && (
              <div
                role={gmailStatus.type === 'error' ? 'alert' : 'status'}
                data-testid="gmail-status-banner"
                className={`text-xs font-medium rounded-lg px-3 py-2 border space-y-2 ${
                  gmailStatus.type === 'error'
                    ? 'text-red-900 bg-red-50 border-red-200'
                    : 'text-teal-900 bg-teal-50 border-teal-200'
                }`}
              >
                <p>{gmailStatus.text}</p>
                {(showRedirectFallback || isSigningInGoogle) && (
                  <div className="flex flex-wrap items-center gap-2">
                    {showRedirectFallback && (
                      <button
                        type="button"
                        disabled={isRedirectingGoogle}
                        onClick={() => void onGoogleRedirectSignIn()}
                        className="inline-flex items-center px-3 py-1.5 text-[11px] font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md transition-colors"
                      >
                        {isRedirectingGoogle
                          ? 'Redirecting to Google...'
                          : 'Try Full-Page Redirect Sign-In Instead'}
                      </button>
                    )}
                    {isSigningInGoogle && (
                      <button
                        type="button"
                        onClick={onCancelGoogleSignIn}
                        className="inline-flex items-center px-3 py-1.5 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              {!googleUser || !hasGmailToken ? (
                <div className="flex flex-wrap items-center gap-2">
                  <GoogleSignInButton
                    disabled={isSigningInGoogle || isRedirectingGoogle}
                    onClick={() => void onGoogleSignIn(gmailScanScope)}
                    label={
                      isRedirectingGoogle
                        ? 'Redirecting to Google...'
                        : isSigningInGoogle
                          ? 'Waiting for Google Sign-In...'
                          : googleUser
                            ? 'Re-authorize Gmail Access'
                            : 'Sign in with Google for Gmail'
                    }
                  />
                  {isSigningInGoogle && (
                    <button
                      type="button"
                      onClick={onCancelGoogleSignIn}
                      className="px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void onScanGmailReceipts(gmailScanScope)}
                  disabled={isSyncingGmail}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isSyncingGmail ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  <span>
                    {isSyncingGmail
                      ? 'Scanning Receipt Emails...'
                      : gmailScanScope === 'payment_apps'
                        ? 'Scan Gmail Payment Receipts Only'
                        : gmailScanScope === 'orders'
                          ? 'Scan Gmail Order Apps'
                          : 'Scan All Gmail Receipts'}
                  </span>
                </button>
              )}

              {googleUser && (
                <button
                  type="button"
                  onClick={() => void onGoogleSignOut()}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Sign Out
                </button>
              )}
            </div>
          </div>

          {/* CSV Statement Import Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                  <Upload className="w-4 h-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    CSV Bank, UPI & Order Export Import
                  </h3>
                  <p className="text-xs text-slate-500">
                    Supports Amazon/EatSure CSVs or bank/UPI statement exports
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Upload any CSV containing columns like <span className="font-mono">Date</span>, <span className="font-mono">Merchant</span> (or <span className="font-mono">Description</span>), <span className="font-mono">Amount</span>, and optional <span className="font-mono">Mode</span> (Online/Cash).
              </p>
            </div>

            {csvNotice && (
              <p
                role="status"
                className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
              >
                {csvNotice}
              </p>
            )}

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Choose CSV File to Import</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvUpload}
                  className="sr-only"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Dedicated Online Payment App Receipt Reader (works without Gmail too) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800 shrink-0">
                <Receipt className="w-4 h-4" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Online Payment App Receipt Reader (GPay, PhonePe, Paytm, BHIM, CRED &amp; UPI)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Paste payment alerts or email/SMS receipts below. Only outgoing payment receipts are read—OTPs, promos, and money-received credits are ignored automatically.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="payment-receipt-paste"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Paste Payment Receipts (one per line or separated by blank lines)
            </label>
            <textarea
              id="payment-receipt-paste"
              rows={3}
              value={paymentReceiptInput}
              onChange={(e) => setPaymentReceiptInput(e.target.value)}
              placeholder={'Example:\nPhonePe: Paid ₹240.00 to North Gate Xerox via UPI Ref 43298122\nYou paid ₹150 to Sharma Tea Stall using Google Pay'}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          {paymentReceiptNotice && (
            <p
              role="status"
              className="text-xs font-medium text-teal-900 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2"
            >
              {paymentReceiptNotice}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <span className="text-[11px] text-slate-500">
              Supports Google Pay, PhonePe, Paytm, BHIM, CRED, Amazon Pay, Razorpay &amp; bank UPI debit receipts.
            </span>
            <button
              type="button"
              onClick={() => {
                if (!paymentReceiptInput.trim()) {
                  setPaymentReceiptNotice(
                    'Paste one or more payment receipt alerts above first.',
                  );
                  return;
                }
                const summary = onImportPaymentReceipts(paymentReceiptInput);
                if (summary.imported > 0) {
                  setPaymentReceiptInput('');
                  setPaymentReceiptNotice(
                    `Imported ${summary.imported} payment receipt(s) into your encrypted vault · Ignored ${summary.ignored} non-receipt message(s) (OTPs, promos, or credits).`,
                  );
                } else {
                  setPaymentReceiptNotice(
                    `Scanned ${summary.totalScanned} message(s) · No outgoing online payment app receipts detected (OTPs, promos, and credits were ignored).`,
                  );
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Receipt className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Read Payment Receipts Only</span>
            </button>
          </div>
        </div>
      </section>

      {/* Section 2: Connected Apps & Account Permissions */}
      <section aria-label="Connected Shopping and Food Apps" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Connected Apps & Account Permissions
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Explicit account consent is required before reading order insights from any shopping or food app.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-600">
            {connectedApps.length} of {apps.length} apps authorized
          </span>
        </div>

        {appSyncStatus && (
          <div
            role={appSyncStatus.type === 'error' ? 'alert' : 'status'}
            data-testid="app-sync-status-banner"
            className={`text-xs font-medium px-4 py-2.5 rounded-lg flex flex-wrap items-center justify-between gap-2 border ${
              appSyncStatus.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-teal-50 border-teal-200 text-teal-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {appSyncStatus.type === 'error' ? (
                <AlertCircle
                  className="w-4 h-4 shrink-0 text-red-700"
                  aria-hidden="true"
                />
              ) : (
                <CheckCircle2
                  className="w-4 h-4 shrink-0 text-teal-700"
                  aria-hidden="true"
                />
              )}
              <span>{appSyncStatus.text}</span>
            </div>
            {(!googleUser || !hasGmailToken) && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isSigningInGoogle || isRedirectingGoogle}
                  onClick={() => void onGoogleSignIn(gmailScanScope)}
                  className="px-3 py-1 text-[11px] font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap"
                >
                  {isRedirectingGoogle
                    ? 'Redirecting...'
                    : isSigningInGoogle
                      ? 'Opening Google...'
                      : 'Connect Gmail Now'}
                </button>
                {showRedirectFallback && (
                  <button
                    type="button"
                    disabled={isRedirectingGoogle}
                    onClick={() => void onGoogleRedirectSignIn()}
                    className="px-2.5 py-1 text-[11px] font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap"
                  >
                    Try Redirect Sign-In
                  </button>
                )}
                {isSigningInGoogle && (
                  <button
                    type="button"
                    onClick={onCancelGoogleSignIn}
                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors whitespace-nowrap"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Authorized Apps Grid */}
        {connectedApps.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {connectedApps.map((app) => (
              <div
                key={app.id}
                data-testid={`connected-app-card-${app.id}`}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <AppBrandIcon appId={app.id} size="md" />
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-slate-900 truncate">
                          {app.name}
                        </h3>
                        <p className="text-xs text-slate-500 truncate">
                          Authorized · {app.accountHandle ?? 'Verified account'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-teal-800 shrink-0">
                      Connected
                    </span>
                  </div>

                  {/* Granular Permission Scopes */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                    <p className="text-xs font-medium text-slate-700">
                      Granted Permissions
                    </p>
                    {app.scopes.map((scope) => (
                      <label
                        key={scope.id}
                        className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={scope.granted}
                          disabled={scope.required}
                          onChange={() => onToggleScope(app.id, scope.id)}
                          className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-700 disabled:opacity-60"
                        />
                        <span>
                          <span className="text-slate-800 font-medium">{scope.label}</span>
                          {scope.required && (
                            <span className="text-slate-400"> (Required)</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {revokingAppId === app.id ? (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <p className="text-xs font-medium text-slate-800">
                      Revoke {app.name} permission?
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onRevokeApp(app.id, true);
                          setRevokingAppId(null);
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                      >
                        Revoke & Purge Data
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onRevokeApp(app.id, false);
                          setRevokingAppId(null);
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        Revoke Only
                      </button>
                      <button
                        type="button"
                        onClick={() => setRevokingAppId(null)}
                        className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleSync(app)}
                      disabled={syncingAppId === app.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${syncingAppId === app.id ? 'animate-spin' : ''}`}
                        aria-hidden="true"
                      />
                      <span>
                        {syncingAppId === app.id
                          ? 'Checking Gmail...'
                          : 'Sync Latest Orders'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRevokingAppId(app.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Unlink className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Revoke Access</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-500">
            No shopping or food apps connected yet. Connect an app below or scan your Gmail receipts above.
          </div>
        )}

        {/* Unconnected Apps Directory */}
        {availableApps.length > 0 && (
          <div className="pt-2 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Available Apps to Connect
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableApps.map((app) => (
                <div
                  key={app.id}
                  data-testid={`available-app-card-${app.id}`}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <AppBrandIcon appId={app.id} size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {app.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {app.category}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600">{app.shortDescription}</p>
                  <button
                    type="button"
                    onClick={() => onRequestConnectApp(app)}
                    className="w-full py-2 px-3 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
                  >
                    Review Permissions & Connect
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Section 3: Personal Vault Creation, Backup Import & Cloud Encrypted Sync */}
      <section aria-label="End-to-End Encryption Vault" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Personal Vault, Backups & Cloud Encrypted Sync
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Create your own blank personal vault, restore from a .json backup, or sync AES-256-GCM ciphertext to Firebase Firestore.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenCreateVault('create')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Create Personal Vault</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenCreateVault('import')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Import Backup (.json)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Live Cryptographic Metadata & Raw Ciphertext Inspector */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0" aria-hidden="true" />
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Vault Cryptographic Profile
                  </h3>
                  <p className="text-xs text-slate-500">
                    {envelope?.hasCustomPassphrase
                      ? 'Protected by your custom vault passphrase'
                      : 'Encrypted with local session key (create a personal vault or set a passphrase below)'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onLockVault}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Lock Vault</span>
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100 text-xs">
              <div>
                <dt className="text-slate-500">Cipher Algorithm</dt>
                <dd className="font-mono font-semibold text-slate-900 mt-0.5">
                  {envelope?.algorithm ?? 'AES-256-GCM'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Key Derivation</dt>
                <dd className="font-mono font-semibold text-slate-900 mt-0.5">
                  {envelope?.kdf ?? 'PBKDF2-SHA256'} ({envelope?.iterations?.toLocaleString() ?? '100,000'})
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Vault Fingerprint</dt>
                <dd className="font-mono text-slate-800 mt-0.5 truncate">
                  {vaultFingerprint || 'Computing...'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Encrypted Payload Size</dt>
                <dd className="font-mono tabular-nums text-slate-800 mt-0.5">
                  {envelope
                    ? `${envelope.ciphertextBase64.length.toLocaleString()} bytes (Base64)`
                    : '—'}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowCiphertext((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-800 hover:text-teal-950"
              >
                {showCiphertext ? (
                  <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>
                  {showCiphertext
                    ? 'Hide Raw Encrypted Storage'
                    : 'Inspect Raw Encrypted Storage'}
                </span>
              </button>

              <button
                type="button"
                onClick={onExportEncryptedBackup}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Export Encrypted Backup</span>
              </button>
            </div>

            {showCiphertext && envelope && (
              <div
                data-testid="raw-ciphertext-panel"
                className="bg-slate-900 text-slate-200 rounded-lg p-3.5 text-[11px] font-mono break-all space-y-1.5"
              >
                <p className="text-slate-400">
                  IV (96-bit): <span className="text-teal-300">{envelope.ivBase64}</span>
                </p>
                <p className="text-slate-400">
                  Salt (128-bit): <span className="text-teal-300">{envelope.saltBase64}</span>
                </p>
                <p className="text-slate-400">
                  Ciphertext Preview:{' '}
                  <span className="text-slate-100">
                    {envelope.ciphertextBase64.slice(0, 260)}...
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Cloud Encrypted Sync (Firestore) */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Cloud className="w-5 h-5 text-teal-700 shrink-0" aria-hidden="true" />
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Cloud Encrypted Vault Sync
                  </h3>
                  <p className="text-xs text-slate-500">
                    Stores only AES-256-GCM ciphertext in Firestore—plaintext never leaves your device.
                  </p>
                </div>
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

            {!googleUser ? (
              <div className="py-4 space-y-3 border-t border-slate-100">
                <p className="text-xs text-slate-600">
                  Sign in with your Google account to sync your encrypted vault across devices and restore it anywhere using your passphrase.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <GoogleSignInButton
                    disabled={isSigningInGoogle || isRedirectingGoogle}
                    onClick={() => void onGoogleSignIn(gmailScanScope)}
                    label={
                      isRedirectingGoogle
                        ? 'Redirecting to Google...'
                        : isSigningInGoogle
                          ? 'Waiting for Google Sign-In...'
                          : 'Sign in with Google to Sync Vault'
                    }
                  />
                  {showRedirectFallback && (
                    <button
                      type="button"
                      disabled={isRedirectingGoogle}
                      onClick={() => void onGoogleRedirectSignIn()}
                      className="px-3 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors"
                    >
                      {isRedirectingGoogle
                        ? 'Redirecting...'
                        : 'Try Redirect Sign-In'}
                    </button>
                  )}
                  {isSigningInGoogle && (
                    <button
                      type="button"
                      onClick={onCancelGoogleSignIn}
                      className="px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">
                    Cloud Account: <strong className="text-slate-900">{googleUser.email}</strong>
                  </span>
                  {lastCloudSyncAt && (
                    <span className="font-mono tabular-nums text-slate-500">
                      Synced {new Date(lastCloudSyncAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void onPushCloudVault()}
                    disabled={isCloudBusy}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    <CloudUpload className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Push Encrypted Vault</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void onPullCloudVault(cloudPullPassphrase || undefined)}
                    disabled={isCloudBusy}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    <CloudDownload className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Pull Cloud Vault</span>
                  </button>
                </div>

                <div>
                  <label
                    htmlFor="cloud-pull-passphrase"
                    className="block text-[11px] font-medium text-slate-600 mb-1"
                  >
                    Passphrase for Cloud Pull (if different from current session)
                  </label>
                  <input
                    id="cloud-pull-passphrase"
                    type="password"
                    value={cloudPullPassphrase}
                    onChange={(e) => setCloudPullPassphrase(e.target.value)}
                    placeholder="Optional passphrase override"
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                  {confirmDeleteCloud ? (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium text-red-700">
                        Delete cloud vault permanently?
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDeleteCloud(false);
                          void onDeleteCloudVault();
                        }}
                        className="px-2.5 py-1 font-medium text-white bg-red-600 hover:bg-red-700 rounded"
                      >
                        Confirm Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteCloud(false)}
                        className="px-2 py-1 text-slate-600 hover:text-slate-900"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteCloud(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 hover:text-red-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Delete Cloud Vault</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Passphrase & Budget Row */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={handlePassphraseSubmit} className="space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-slate-700" aria-hidden="true" />
              <h3 className="text-base font-semibold text-slate-900">
                Set or Change Vault Passphrase
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Re-encrypts your entire ledger and connected app tokens with a fresh random salt and IV.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="new-passphrase"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  New Passphrase
                </label>
                <input
                  id="new-passphrase"
                  type="password"
                  value={newPassphrase}
                  onChange={(e) => setNewPassphrase(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
              <div>
                <label
                  htmlFor="confirm-passphrase"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Confirm Passphrase
                </label>
                <input
                  id="confirm-passphrase"
                  type="password"
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                  placeholder="Re-enter passphrase"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
            </div>

            {passphraseMsg && (
              <p
                role="status"
                className={`text-xs font-medium ${
                  passphraseMsg.type === 'success' ? 'text-teal-800' : 'text-red-700'
                }`}
              >
                {passphraseMsg.text}
              </p>
            )}

            <button
              type="submit"
              disabled={isUpdatingPassphrase}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors"
            >
              {isUpdatingPassphrase ? 'Re-encrypting...' : 'Update & Re-encrypt Vault'}
            </button>
          </form>

          <div className="flex flex-col justify-between gap-4 lg:border-l lg:border-slate-100 lg:pl-6">
            <form onSubmit={handleBudgetSubmit} className="flex flex-wrap items-end gap-3">
              <div>
                <label
                  htmlFor="monthly-budget-input"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Monthly Student Budget (INR)
                </label>
                <input
                  id="monthly-budget-input"
                  type="number"
                  min={500}
                  step={500}
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  className="w-40 px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                {budgetSaved ? 'Saved' : `Save (${formatINR(Number(budgetInput) || 0)})`}
              </button>
            </form>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                Restore sample student ledger for testing
              </span>
              <button
                type="button"
                onClick={onResetDemoVault}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reset Demo Data</span>
              </button>
            </div>
          </div>
        </div>

        {/* Nightly Spend Summary Notifications Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800 shrink-0">
                <Bell className="w-4 h-4" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Nightly Spend Summary & Manual Expense Reminder
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Receive an evening check-in showing today&apos;s total spend and prompting you to log cash or split group orders.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                const msg = await onEnableNightlyReminders(!reminderSettings.enabled);
                setReminderNotice(msg);
              }}
              aria-pressed={reminderSettings.enabled}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                reminderSettings.enabled
                  ? 'bg-teal-700 text-white hover:bg-teal-800'
                  : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
              }`}
            >
              {reminderSettings.enabled
                ? `Enabled (${formatTime12h(reminderSettings.nightlyTime)})`
                : 'Enable Nightly Reminder'}
            </button>
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label
                  htmlFor="nightly-reminder-time"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Nightly Reminder Time
                </label>
                <input
                  id="nightly-reminder-time"
                  type="time"
                  value={reminderSettings.nightlyTime}
                  onChange={(e) => onUpdateNightlyTime(e.target.value)}
                  className="px-3 py-1.5 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>

              <button
                type="button"
                onClick={() => void onSendNightlyPreview()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <Bell className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Send Tonight&apos;s Summary Now</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-500 max-w-md">
              Runs locally in your browser/PWA without uploading spend totals to external push servers.
            </p>
          </div>

          {reminderNotice && (
            <p
              role="status"
              className="text-xs font-medium text-teal-900 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2"
            >
              {reminderNotice}
            </p>
          )}

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
            <p className="font-medium text-slate-800">{nightlySummary.title}</p>
            <p className="text-slate-600">{nightlySummary.body}</p>
          </div>
        </div>

        {/* Mobile App Installation (PWA) Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800 shrink-0">
              <Smartphone className="w-4 h-4" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Install as Mobile App (No APK Needed)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Launch CampusLedger full-screen from your phone home screen and track cash or encrypted local expenses offline.
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <PWAInstallButton showAlwaysInSettings />
          </div>
        </div>
      </section>
    </div>
  );
}
