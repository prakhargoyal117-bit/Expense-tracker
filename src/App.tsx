import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { Bell, Lock, Menu, Plus, PlusCircle, ShieldCheck } from 'lucide-react';
import {
  type AppId,
  type ConnectedApp,
  type EncryptedVaultEnvelope,
  type ExpenseEntry,
  type ExpenseFilters,
  type ManualExpenseInput,
  type ReminderPreferences,
  type VaultData,
} from './types/expense';
import {
  APP_SYNC_TEMPLATES,
  CURRENT_MONTH,
  DEFAULT_VAULT_PASSPHRASE,
  INITIAL_APPS,
  TODAY_DATE,
  createInitialVaultData,
  mergeMissingApps,
} from './data/seedData';
import {
  computeSha256Fingerprint,
  decryptVaultPayload,
  encryptVaultPayload,
} from './utils/crypto';
import {
  computeAppInsights,
  computeCategoryBreakdown,
  computeDailySeries,
  computeMonthlySummary,
  filterExpenses,
  formatMonthLabel,
  generateExpensesCsv,
  getAvailableMonths,
} from './utils/analytics';
import {
  parsePaymentAppReceiptBatch,
  parseStatementCsv,
} from './utils/gmailParser';
import {
  DEFAULT_REMINDER_SETTINGS,
  buildNightlySummary,
  dispatchBrowserNotification,
  formatTime12h,
  getLocalTodayDateStr,
  shouldTriggerNightlyReminder,
} from './utils/reminders';
import {
  deleteCloudEncryptedVault,
  fetchCloudEncryptedVault,
  getInMemoryGmailToken,
  initFirebaseAuth,
  saveCloudEncryptedVault,
  signInWithGoogleForVaultAndGmail,
  signOutGoogle,
  testFirestoreConnection,
} from './services/firebaseService';
import {
  type GmailScanScope,
  scanGmailOrderReceipts,
} from './services/gmailService';
import { Sidebar, type NavSection } from './components/Sidebar';
import { OverviewView } from './components/OverviewView';
import { AppInsightsView } from './components/AppInsightsView';
import { TransactionsView } from './components/TransactionsView';
import { AppsAndSecurityView } from './components/AppsAndSecurityView';
import { AddExpenseModal } from './components/AddExpenseModal';
import { EditExpenseModal } from './components/EditExpenseModal';
import { PermissionConsentModal } from './components/PermissionConsentModal';
import { VaultLockScreen } from './components/VaultLockScreen';
import {
  CreateVaultModal,
  type NewPersonalVaultInput,
} from './components/CreateVaultModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';

const STORAGE_KEY = 'campusledger_e2ee_vault_v1';

const SECTION_TITLES: Record<NavSection, string> = {
  overview: 'Overview',
  insights: 'App Insights',
  transactions: 'Transactions',
  security: 'Apps & Security',
};

export default function App() {
  const [vault, setVault] = useState<VaultData | null>(null);
  const [envelope, setEnvelope] = useState<EncryptedVaultEnvelope | null>(null);
  const [activePassphrase, setActivePassphrase] = useState<string>(
    DEFAULT_VAULT_PASSPHRASE,
  );
  const [vaultFingerprint, setVaultFingerprint] = useState<string>('');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(true);

  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [selectedMonth, setSelectedMonth] = useState<string>(CURRENT_MONTH);
  const [selectedDate, setSelectedDate] = useState<string>(TODAY_DATE);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null);
  const [showNightlyCheckIn, setShowNightlyCheckIn] = useState<boolean>(false);
  const [pendingConsentApp, setPendingConsentApp] =
    useState<ConnectedApp | null>(null);
  const [createVaultModal, setCreateVaultModal] = useState<{
    open: boolean;
    mode: 'create' | 'import';
  }>({ open: false, mode: 'create' });

  // Google Auth, Gmail Sync & Cloud Encrypted Sync state
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [hasGmailToken, setHasGmailToken] = useState<boolean>(false);
  const [isSyncingGmail, setIsSyncingGmail] = useState<boolean>(false);
  const [gmailStatusMessage, setGmailStatusMessage] = useState<string | null>(
    null,
  );
  const [cloudSyncStatus, setCloudSyncStatus] = useState<string | null>(null);
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(null);
  const [isCloudBusy, setIsCloudBusy] = useState<boolean>(false);

  const [filters, setFilters] = useState<ExpenseFilters>({
    month: CURRENT_MONTH,
    search: '',
    mode: 'all',
    appId: 'all',
    category: 'all',
  });

  const persistEncryptedVault = useCallback(
    async (
      nextVault: VaultData,
      passphrase: string,
      hasCustomPassphrase: boolean,
    ): Promise<EncryptedVaultEnvelope> => {
      const nextEnvelope = await encryptVaultPayload(
        nextVault,
        passphrase,
        hasCustomPassphrase,
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEnvelope));
      setEnvelope(nextEnvelope);
      const fp = await computeSha256Fingerprint(nextEnvelope.ciphertextBase64);
      setVaultFingerprint(fp);
      return nextEnvelope;
    },
    [],
  );

  // Initialize Firebase connection check and auth state listener
  useEffect(() => {
    void testFirestoreConnection();
    const unsub = initFirebaseAuth((user, token) => {
      setGoogleUser(user);
      setHasGmailToken(Boolean(token));
    });
    return () => unsub();
  }, []);

  // Bootstrap encrypted vault from localStorage or initialize fresh encrypted demo vault
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const params = new URLSearchParams(window.location.search);
      const autostart = params.get('autostart') === '1';

      const rawStored = localStorage.getItem(STORAGE_KEY);
      if (rawStored) {
        try {
          const parsed = JSON.parse(rawStored) as EncryptedVaultEnvelope;
          if (!cancelled) {
            setEnvelope(parsed);
            const fp = await computeSha256Fingerprint(parsed.ciphertextBase64);
            if (!cancelled) setVaultFingerprint(fp);
          }

          if (!parsed.hasCustomPassphrase || autostart) {
            try {
              const decrypted = await decryptVaultPayload<VaultData>(
                parsed,
                DEFAULT_VAULT_PASSPHRASE,
              );
              if (!cancelled) {
                setVault({
                  ...decrypted,
                  apps: mergeMissingApps(decrypted.apps),
                });
                setActivePassphrase(DEFAULT_VAULT_PASSPHRASE);
                setIsLocked(false);
                setIsBootstrapping(false);
              }
              return;
            } catch {
              if (!cancelled) {
                setVault(null);
                setIsLocked(true);
                setIsBootstrapping(false);
              }
              return;
            }
          } else {
            if (!cancelled) {
              setVault(null);
              setIsLocked(true);
              setIsBootstrapping(false);
            }
            return;
          }
        } catch {
          // Corrupted JSON in storage; re-seed below
        }
      }

      const initial = createInitialVaultData();
      const initialEnvelope = await encryptVaultPayload(
        initial,
        DEFAULT_VAULT_PASSPHRASE,
        false,
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialEnvelope));
      const fp = await computeSha256Fingerprint(initialEnvelope.ciphertextBase64);
      if (!cancelled) {
        setVault(initial);
        setEnvelope(initialEnvelope);
        setActivePassphrase(DEFAULT_VAULT_PASSPHRASE);
        setVaultFingerprint(fp);
        setIsLocked(false);
        setIsBootstrapping(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateVault = useCallback(
    (updater: (prev: VaultData) => VaultData) => {
      setVault((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        void persistEncryptedVault(
          next,
          activePassphrase,
          envelope?.hasCustomPassphrase ?? false,
        );
        return next;
      });
    },
    [activePassphrase, envelope?.hasCustomPassphrase, persistEncryptedVault],
  );

  // Sync month selection with filters
  const handleSelectMonth = (monthKey: string) => {
    setSelectedMonth(monthKey);
    setFilters((prev) => ({ ...prev, month: monthKey }));
    if (monthKey === CURRENT_MONTH) {
      setSelectedDate(TODAY_DATE);
    } else if (monthKey !== 'all') {
      setSelectedDate(`${monthKey}-15`);
    }
  };

  // Manual expense creation
  const handleAddManualExpense = (input: ManualExpenseInput) => {
    const newEntry: ExpenseEntry = {
      id: `manual-${Date.now()}`,
      merchant: input.merchant.trim(),
      amount: Math.round(Number(input.amount)),
      date: input.date,
      time: input.time,
      mode: input.mode,
      category: input.category,
      appId: input.appId,
      source: 'manual',
      notes: input.notes,
      groupSplit: input.groupSplit,
    };

    updateVault((prev) => ({
      ...prev,
      expenses: [newEntry, ...prev.expenses],
    }));

    const entryMonth = input.date.slice(0, 7);
    if (entryMonth !== selectedMonth && selectedMonth !== 'all') {
      setSelectedMonth(entryMonth);
      setFilters((prev) => ({ ...prev, month: entryMonth }));
    }
    setSelectedDate(input.date);
  };

  const handleUpdateExpense = (updated: ExpenseEntry) => {
    updateVault((prev) => ({
      ...prev,
      expenses: prev.expenses.map((e) => (e.id === updated.id ? updated : e)),
    }));
  };

  const handleDeleteExpense = (id: string) => {
    updateVault((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== id),
    }));
  };

  const handleApproveApp = (
    app: ConnectedApp,
    accountHandle: string,
    grantedScopeIds: string[],
  ) => {
    const nowIso = new Date().toISOString();
    const templates = APP_SYNC_TEMPLATES[app.id] ?? [];

    updateVault((prev) => {
      const existingIds = new Set(prev.expenses.map((e) => e.id));
      const newSynced = templates.filter((t) => !existingIds.has(t.id));

      return {
        ...prev,
        apps: prev.apps.map((a) =>
          a.id === app.id
            ? {
                ...a,
                isConnected: true,
                connectedAt: nowIso,
                lastSyncedAt: nowIso,
                accountHandle,
                scopes: a.scopes.map((s) => ({
                  ...s,
                  granted: grantedScopeIds.includes(s.id),
                })),
              }
            : a,
        ),
        expenses: [...newSynced, ...prev.expenses],
      };
    });

    setPendingConsentApp(null);
  };

  const handleSyncApp = (appId: AppId) => {
    const nowIso = new Date().toISOString();
    const templates = APP_SYNC_TEMPLATES[appId] ?? [];

    updateVault((prev) => {
      const existingIds = new Set(prev.expenses.map((e) => e.id));
      const freshEntries = templates.filter((t) => !existingIds.has(t.id));

      return {
        ...prev,
        apps: prev.apps.map((a) =>
          a.id === appId ? { ...a, lastSyncedAt: nowIso } : a,
        ),
        expenses: [...freshEntries, ...prev.expenses],
      };
    });
  };

  const handleToggleScope = (appId: AppId, scopeId: string) => {
    updateVault((prev) => ({
      ...prev,
      apps: prev.apps.map((a) =>
        a.id === appId
          ? {
              ...a,
              scopes: a.scopes.map((s) =>
                s.id === scopeId && !s.required ? { ...s, granted: !s.granted } : s,
              ),
            }
          : a,
      ),
    }));
  };

  const handleRevokeApp = (appId: AppId, purgeData: boolean) => {
    updateVault((prev) => ({
      ...prev,
      apps: prev.apps.map((a) =>
        a.id === appId
          ? {
              ...a,
              isConnected: false,
              connectedAt: null,
              lastSyncedAt: null,
              accountHandle: null,
              scopes: a.scopes.map((s) => ({ ...s, granted: false })),
            }
          : a,
      ),
      expenses: purgeData
        ? prev.expenses.filter((e) => e.appId !== appId)
        : prev.expenses,
    }));
  };

  const handleUpdateBudget = (budget: number) => {
    updateVault((prev) => ({
      ...prev,
      monthlyBudget: budget,
    }));
  };

  const handleSetPassphrase = async (newPassphrase: string) => {
    if (!vault) return;
    await persistEncryptedVault(vault, newPassphrase, true);
    setActivePassphrase(newPassphrase);
  };

  const handleLockVault = () => {
    setVault(null);
    setActivePassphrase('');
    setIsLocked(true);
  };

  const handleUnlockVault = async (passphrase: string): Promise<boolean> => {
    if (!envelope) return false;
    try {
      const decrypted = await decryptVaultPayload<VaultData>(envelope, passphrase);
      setVault({
        ...decrypted,
        apps: mergeMissingApps(decrypted.apps),
      });
      setActivePassphrase(passphrase);
      setIsLocked(false);
      return true;
    } catch {
      return false;
    }
  };

  const handleResetDemoVault = async () => {
    const initial = createInitialVaultData();
    await persistEncryptedVault(initial, DEFAULT_VAULT_PASSPHRASE, false);
    setVault(initial);
    setActivePassphrase(DEFAULT_VAULT_PASSPHRASE);
    setSelectedMonth(CURRENT_MONTH);
    setSelectedDate(TODAY_DATE);
    setFilters({
      month: CURRENT_MONTH,
      search: '',
      mode: 'all',
      appId: 'all',
      category: 'all',
    });
    setIsLocked(false);
  };

  // Create Personal Vault (blank or seeded)
  const handleCreatePersonalVault = async (input: NewPersonalVaultInput) => {
    const baseData = createInitialVaultData();
    const freshVault: VaultData = {
      studentName: input.studentName,
      campusName: input.campusName,
      monthlyBudget: input.monthlyBudget,
      expenses: input.startBlank ? [] : baseData.expenses,
      apps: input.startBlank
        ? INITIAL_APPS.map((a) => ({
            ...a,
            isConnected: false,
            connectedAt: null,
            lastSyncedAt: null,
            accountHandle: null,
            scopes: a.scopes.map((s) => ({ ...s, granted: false })),
          }))
        : baseData.apps,
    };

    const newEnv = await persistEncryptedVault(
      freshVault,
      input.passphrase,
      true,
    );
    setVault(freshVault);
    setActivePassphrase(input.passphrase);
    setIsLocked(false);

    if (input.startBlank) {
      setSelectedMonth('all');
      setFilters({
        month: 'all',
        search: '',
        mode: 'all',
        appId: 'all',
        category: 'all',
      });
    }

    if (googleUser) {
      try {
        await saveCloudEncryptedVault(googleUser.uid, newEnv);
        setLastCloudSyncAt(new Date().toISOString());
        setCloudSyncStatus('Personal encrypted vault created and synced to cloud.');
      } catch {
        setCloudSyncStatus(
          'Personal vault created locally. Click Push Encrypted Vault to sync to cloud.',
        );
      }
    }
  };

  // Restore Encrypted Backup (.json)
  const handleImportBackup = async (
    backupEnvelope: EncryptedVaultEnvelope,
    passphrase: string,
  ): Promise<boolean> => {
    try {
      const decrypted = await decryptVaultPayload<VaultData>(
        backupEnvelope,
        passphrase,
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(backupEnvelope));
      setEnvelope(backupEnvelope);
      const fp = await computeSha256Fingerprint(backupEnvelope.ciphertextBase64);
      setVaultFingerprint(fp);
      setVault({
        ...decrypted,
        apps: mergeMissingApps(decrypted.apps),
      });
      setActivePassphrase(passphrase);
      setIsLocked(false);

      const months = getAvailableMonths(decrypted.expenses);
      const targetMonth = months[0] ?? 'all';
      setSelectedMonth(targetMonth);
      setFilters({
        month: targetMonth,
        search: '',
        mode: 'all',
        appId: 'all',
        category: 'all',
      });
      return true;
    } catch {
      return false;
    }
  };

  // Google Sign-In for Gmail + Cloud Vault Sync
  const handleGoogleSignIn = async () => {
    setGmailStatusMessage(null);
    setCloudSyncStatus(null);
    try {
      const { user, accessToken } = await signInWithGoogleForVaultAndGmail();
      setGoogleUser(user);
      setHasGmailToken(Boolean(accessToken));
      if (accessToken) {
        setGmailStatusMessage(
          `Connected ${user.email}. Click "Scan Gmail for Order Receipts" to import orders.`,
        );
      }
    } catch (err) {
      setCloudSyncStatus(
        err instanceof Error
          ? `Google Sign-In failed: ${err.message}`
          : 'Google Sign-In failed.',
      );
    }
  };

  const handleGoogleSignOut = async () => {
    await signOutGoogle();
    setGoogleUser(null);
    setHasGmailToken(false);
    setGmailStatusMessage(null);
    setCloudSyncStatus(null);
  };

  // Scan Gmail order or payment-app receipts using in-memory OAuth token
  const handleScanGmailReceipts = async (scope: GmailScanScope = 'all') => {
    const token = getInMemoryGmailToken();
    if (!token) {
      setHasGmailToken(false);
      setGmailStatusMessage(
        'Gmail session expired. Click Re-authorize Gmail Access to refresh.',
      );
      return;
    }

    setIsSyncingGmail(true);
    setGmailStatusMessage(null);
    try {
      const result = await scanGmailOrderReceipts(token, scope);
      if (result.importedEntries.length === 0) {
        setGmailStatusMessage(
          scope === 'payment_apps'
            ? `Scanned ${result.scannedCount} recent emails · No new online payment app receipts found (OTPs, promos, and credits were ignored).`
            : `Scanned ${result.scannedCount} recent emails · No new EatSure, Zomato, Swiggy, Amazon, or UPI receipts found.`,
        );
        return;
      }

      let addedCount = 0;
      const nowIso = new Date().toISOString();

      updateVault((prev) => {
        const existingIds = new Set(prev.expenses.map((e) => e.id));
        const fresh = result.importedEntries.filter(
          (entry) => !existingIds.has(entry.id),
        );
        addedCount = fresh.length;
        const matchedAppIds = new Set(fresh.map((e) => e.appId));

        return {
          ...prev,
          expenses: [...fresh, ...prev.expenses],
          apps: prev.apps.map((app) =>
            matchedAppIds.has(app.id)
              ? {
                  ...app,
                  isConnected: true,
                  connectedAt: app.connectedAt ?? nowIso,
                  lastSyncedAt: nowIso,
                  accountHandle: googleUser?.email ?? app.accountHandle ?? 'Gmail Sync',
                  scopes: app.scopes.map((s) => ({ ...s, granted: true })),
                }
              : app,
          ),
        };
      });

      setGmailStatusMessage(
        `Scanned ${result.scannedCount} emails · Imported ${addedCount} new receipt(s) into your encrypted vault.`,
      );
    } catch (err) {
      setGmailStatusMessage(
        err instanceof Error
          ? `Gmail scan failed: ${err.message}`
          : 'Unable to scan Gmail receipts.',
      );
    } finally {
      setIsSyncingGmail(false);
    }
  };

  // Parse pasted payment receipts from any online payment app (GPay, PhonePe, Paytm, BHIM, CRED, UPI)
  const handleImportPaymentReceipts = (rawText: string) => {
    const batch = parsePaymentAppReceiptBatch(rawText, selectedDate || TODAY_DATE);
    if (batch.receipts.length === 0) {
      return {
        imported: 0,
        ignored: batch.ignoredCount,
        totalScanned: batch.totalScanned,
      };
    }

    const nowIso = new Date().toISOString();
    updateVault((prev) => {
      const matchedAppIds = new Set(batch.receipts.map((r) => r.appId));
      return {
        ...prev,
        expenses: [...batch.receipts, ...prev.expenses],
        apps: prev.apps.map((app) =>
          matchedAppIds.has(app.id)
            ? {
                ...app,
                isConnected: true,
                connectedAt: app.connectedAt ?? nowIso,
                lastSyncedAt: nowIso,
              }
            : app,
        ),
      };
    });

    return {
      imported: batch.receipts.length,
      ignored: batch.ignoredCount,
      totalScanned: batch.totalScanned,
    };
  };

  // Import CSV Statement
  const handleImportCsvText = (csvText: string): number => {
    const parsed = parseStatementCsv(csvText);
    if (parsed.length === 0) return 0;

    updateVault((prev) => ({
      ...prev,
      expenses: [...parsed, ...prev.expenses],
    }));

    return parsed.length;
  };

  // Cloud Encrypted Sync (Push / Pull / Delete)
  const handlePushCloudVault = async () => {
    if (!googleUser || !envelope) return;
    setIsCloudBusy(true);
    setCloudSyncStatus(null);
    try {
      await saveCloudEncryptedVault(googleUser.uid, envelope);
      const now = new Date().toISOString();
      setLastCloudSyncAt(now);
      setCloudSyncStatus(
        `Encrypted vault pushed to Firestore (${envelope.ciphertextBase64.length.toLocaleString()} bytes ciphertext).`,
      );
    } catch (err) {
      setCloudSyncStatus(
        err instanceof Error ? `Cloud push failed: ${err.message}` : 'Cloud push failed.',
      );
    } finally {
      setIsCloudBusy(false);
    }
  };

  const handlePullCloudVault = async (passphraseOverride?: string) => {
    if (!googleUser) return;
    setIsCloudBusy(true);
    setCloudSyncStatus(null);
    try {
      const record = await fetchCloudEncryptedVault(googleUser.uid);
      if (!record) {
        setCloudSyncStatus('No cloud vault found for this Google account yet.');
        return;
      }
      const passToUse =
        passphraseOverride?.trim() ||
        (record.envelope.hasCustomPassphrase
          ? activePassphrase
          : DEFAULT_VAULT_PASSPHRASE);

      const ok = await handleImportBackup(record.envelope, passToUse);
      if (!ok) {
        setCloudSyncStatus(
          'Cloud vault found, but decryption failed. Enter the cloud vault passphrase in the field below and try Pull again.',
        );
        return;
      }
      setLastCloudSyncAt(record.syncedAtIso);
      setCloudSyncStatus('Cloud encrypted vault decrypted and restored locally.');
    } catch (err) {
      setCloudSyncStatus(
        err instanceof Error ? `Cloud pull failed: ${err.message}` : 'Cloud pull failed.',
      );
    } finally {
      setIsCloudBusy(false);
    }
  };

  const handleDeleteCloudVault = async () => {
    if (!googleUser) return;
    setIsCloudBusy(true);
    setCloudSyncStatus(null);
    try {
      await deleteCloudEncryptedVault(googleUser.uid);
      setLastCloudSyncAt(null);
      setCloudSyncStatus('Cloud encrypted vault deleted from Firestore.');
    } catch (err) {
      setCloudSyncStatus(
        err instanceof Error ? `Cloud delete failed: ${err.message}` : 'Cloud delete failed.',
      );
    } finally {
      setIsCloudBusy(false);
    }
  };

  const handleExportEncryptedBackup = () => {
    if (!envelope) return;
    const blob = new Blob([JSON.stringify(envelope, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `campusledger-encrypted-vault-${TODAY_DATE}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    if (!vault) return;
    const csv = generateExpensesCsv(filteredExpensesList, vault.apps);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `campusledger-expenses-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Derived analytics
  const availableMonths = useMemo(() => {
    if (!vault) return [CURRENT_MONTH];
    const months = getAvailableMonths(vault.expenses);
    return months.length > 0 ? months : [CURRENT_MONTH];
  }, [vault]);

  const summary = useMemo(() => {
    if (!vault) return null;
    const refDays = selectedMonth === CURRENT_MONTH ? 15 : undefined;
    return computeMonthlySummary(
      vault.expenses,
      vault.apps,
      selectedMonth,
      vault.monthlyBudget,
      refDays,
    );
  }, [vault, selectedMonth]);

  const dailySeries = useMemo(() => {
    if (!vault) return [];
    const chartMonth =
      selectedMonth === 'all'
        ? (availableMonths[0] ?? CURRENT_MONTH)
        : selectedMonth;
    return computeDailySeries(vault.expenses, vault.apps, chartMonth);
  }, [vault, selectedMonth, availableMonths]);

  const appInsights = useMemo(() => {
    if (!vault) return [];
    return computeAppInsights(vault.expenses, vault.apps, selectedMonth);
  }, [vault, selectedMonth]);

  const categoryInsights = useMemo(() => {
    if (!vault) return [];
    return computeCategoryBreakdown(vault.expenses, selectedMonth);
  }, [vault, selectedMonth]);

  const filteredExpensesList = useMemo(() => {
    if (!vault) return [];
    return filterExpenses(vault.expenses, filters);
  }, [vault, filters]);

  const recentMonthExpenses = useMemo(() => {
    if (!vault) return [];
    return filterExpenses(vault.expenses, {
      month: selectedMonth,
      search: '',
      mode: 'all',
      appId: 'all',
      category: 'all',
    });
  }, [vault, selectedMonth]);

  // Nightly Spend Summary Reminders
  const reminderSettings: ReminderPreferences =
    vault?.reminderSettings ?? DEFAULT_REMINDER_SETTINGS;

  const nightlySummary = useMemo(() => {
    const todayLocal = getLocalTodayDateStr();
    // If today has entries use real local date; if demo vault is seeded on TODAY_DATE, show whichever matches
    const hasLocalEntries = (vault?.expenses ?? []).some((e) => e.date === todayLocal);
    const targetDate = hasLocalEntries ? todayLocal : TODAY_DATE;
    return buildNightlySummary(vault?.expenses ?? [], targetDate);
  }, [vault?.expenses]);

  const handleEnableNightlyReminders = async (
    enabled: boolean,
  ): Promise<string | null> => {
    if (enabled && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        try {
          await Notification.requestPermission();
        } catch {
          // Ignore permission request failure in restricted contexts
        }
      }
    }

    updateVault((prev) => ({
      ...prev,
      reminderSettings: {
        ...(prev.reminderSettings ?? DEFAULT_REMINDER_SETTINGS),
        enabled,
      },
    }));

    if (!enabled) {
      return 'Nightly reminders paused.';
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        return `Nightly summary notifications enabled for ${formatTime12h(
          reminderSettings.nightlyTime,
        )}.`;
      }
      if (Notification.permission === 'denied') {
        return 'Browser notification permission is blocked—in-app nightly check-in prompts will still appear when you open CampusLedger.';
      }
    }
    return `Nightly check-in enabled for ${formatTime12h(reminderSettings.nightlyTime)}.`;
  };

  const handleUpdateNightlyTime = (nightlyTime: string) => {
    if (!nightlyTime) return;
    updateVault((prev) => ({
      ...prev,
      reminderSettings: {
        ...(prev.reminderSettings ?? DEFAULT_REMINDER_SETTINGS),
        nightlyTime,
      },
    }));
  };

  const handleSendNightlyPreview = async () => {
    await dispatchBrowserNotification(nightlySummary.title, nightlySummary.body);
    setShowNightlyCheckIn(true);
  };

  useEffect(() => {
    if (!vault || isLocked) return;
    const checkSchedule = async () => {
      const prefs = vault.reminderSettings ?? DEFAULT_REMINDER_SETTINGS;
      if (!shouldTriggerNightlyReminder(prefs)) return;

      const todayStr = getLocalTodayDateStr();
      await dispatchBrowserNotification(nightlySummary.title, nightlySummary.body);
      setShowNightlyCheckIn(true);
      updateVault((prev) => ({
        ...prev,
        reminderSettings: {
          ...(prev.reminderSettings ?? DEFAULT_REMINDER_SETTINGS),
          lastNotifiedDate: todayStr,
        },
      }));
    };

    void checkSchedule();
    const timer = window.setInterval(() => {
      void checkSchedule();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [vault, isLocked, nightlySummary, updateVault]);

  if (isBootstrapping) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl px-6 py-5 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-teal-700" aria-hidden="true" />
          <span className="text-sm font-medium text-slate-700">
            Decrypting AES-256-GCM vault...
          </span>
        </div>
      </div>
    );
  }

  if (isLocked || !vault || !summary) {
    return (
      <>
        <VaultLockScreen
          envelope={envelope}
          onUnlock={handleUnlockVault}
          onResetDemoVault={() => void handleResetDemoVault()}
          onOpenCreateVault={(mode) => setCreateVaultModal({ open: true, mode })}
        />
        <CreateVaultModal
          key={`${createVaultModal.open}-${createVaultModal.mode}`}
          isOpen={createVaultModal.open}
          initialMode={createVaultModal.mode}
          onClose={() => setCreateVaultModal((p) => ({ ...p, open: false }))}
          onCreateVault={handleCreatePersonalVault}
          onImportBackup={handleImportBackup}
        />
        <OfflineIndicator />
      </>
    );
  }

  const connectedCount = vault.apps.filter((a) => a.isConnected).length;
  const unconnectedApps = vault.apps.filter((a) => !a.isConnected);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar
        activeSection={activeSection}
        onNavigate={(section) => {
          setActiveSection(section);
          window.scrollTo({ top: 0, behavior: 'auto' });
        }}
        studentName={vault.studentName}
        campusName={vault.campusName}
        monthlySpend={summary.totalSpend}
        monthlyBudget={vault.monthlyBudget}
        connectedCount={connectedCount}
        isOpenMobile={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline">CampusLedger</span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-semibold text-slate-900 truncate">
                {SECTION_TITLES[activeSection]}
              </h1>
            </div>

            <div className="hidden md:block pl-3 border-l border-slate-200">
              <label htmlFor="header-month-select" className="sr-only">
                Select month
              </label>
              <select
                id="header-month-select"
                value={selectedMonth}
                onChange={(e) => handleSelectMonth(e.target.value)}
                className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))}
                <option value="all">All Months</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton />
            <div className="inline-flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setCreateVaultModal({ open: true, mode: 'create' })}
                aria-label="Create personal encrypted vault"
                data-testid="header-create-vault-box"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-teal-900 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <PlusCircle className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                <span className="hidden sm:inline">Create Vault</span>
              </button>
              <button
                type="button"
                onClick={handleLockVault}
                aria-label="Lock encrypted vault"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Lock Vault</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsAddExpenseOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Add Expense</span>
            </button>
          </div>
        </header>

        {/* Mobile Month Selector Strip */}
        <div className="md:hidden px-4 pt-3 flex items-center justify-between gap-3">
          <label
            htmlFor="mobile-month-select"
            className="text-xs font-medium text-slate-600"
          >
            Period:
          </label>
          <select
            id="mobile-month-select"
            value={selectedMonth}
            onChange={(e) => handleSelectMonth(e.target.value)}
            className="text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
            <option value="all">All Months</option>
          </select>
        </div>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {showNightlyCheckIn && (
            <section
              role="region"
              aria-label="Nightly Spend Check-in"
              className="bg-teal-950 text-white rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-teal-800/80 flex items-center justify-center text-teal-200 shrink-0 mt-0.5">
                  <Bell className="w-4 h-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold">{nightlySummary.title}</h2>
                  <p className="text-xs text-teal-100 mt-0.5">{nightlySummary.body}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddExpenseOpen(true)}
                  className="px-3.5 py-2 text-xs font-medium text-teal-950 bg-white hover:bg-teal-50 rounded-lg transition-colors"
                >
                  Add Manual Expense
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection('transactions');
                    setShowNightlyCheckIn(false);
                  }}
                  className="px-3.5 py-2 text-xs font-medium text-teal-100 bg-teal-900 hover:bg-teal-800 rounded-lg transition-colors"
                >
                  Split / Edit Orders
                </button>
                <button
                  type="button"
                  onClick={() => setShowNightlyCheckIn(false)}
                  className="px-3 py-2 text-xs font-medium text-teal-200 hover:text-white"
                >
                  Dismiss
                </button>
              </div>
            </section>
          )}

          {activeSection === 'overview' && (
            <OverviewView
              summary={summary}
              dailySeries={dailySeries}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              appInsights={appInsights}
              categoryInsights={categoryInsights}
              recentExpenses={recentMonthExpenses}
              onNavigate={setActiveSection}
              onOpenAddExpense={() => setIsAddExpenseOpen(true)}
              onEditExpense={(item) => setEditingExpense(item)}
              onFilterByApp={(appId) => {
                setFilters((prev) => ({ ...prev, appId, month: selectedMonth }));
                setActiveSection('transactions');
              }}
            />
          )}

          {activeSection === 'insights' && (
            <AppInsightsView
              appInsights={appInsights}
              categoryInsights={categoryInsights}
              totalSpend={summary.totalSpend}
              unconnectedApps={unconnectedApps}
              onFilterByApp={(appId) => {
                setFilters((prev) => ({ ...prev, appId, month: selectedMonth }));
                setActiveSection('transactions');
              }}
              onRequestConnectApp={(app) => setPendingConsentApp(app)}
            />
          )}

          {activeSection === 'transactions' && (
            <TransactionsView
              expenses={filteredExpensesList}
              apps={vault.apps}
              filters={filters}
              onUpdateFilters={(next) =>
                setFilters((prev) => ({ ...prev, ...next }))
              }
              onEditExpense={(item) => setEditingExpense(item)}
              onDeleteExpense={handleDeleteExpense}
              onOpenAddExpense={() => setIsAddExpenseOpen(true)}
              onExportCsv={handleExportCsv}
              onImportCsvText={handleImportCsvText}
            />
          )}

          {activeSection === 'security' && (
            <AppsAndSecurityView
              apps={vault.apps}
              envelope={envelope}
              vaultFingerprint={vaultFingerprint}
              monthlyBudget={vault.monthlyBudget}
              googleUser={googleUser}
              hasGmailToken={hasGmailToken}
              isSyncingGmail={isSyncingGmail}
              gmailStatusMessage={gmailStatusMessage}
              cloudSyncStatus={cloudSyncStatus}
              lastCloudSyncAt={lastCloudSyncAt}
              isCloudBusy={isCloudBusy}
              onRequestConnectApp={(app) => setPendingConsentApp(app)}
              onSyncApp={handleSyncApp}
              onToggleScope={handleToggleScope}
              onRevokeApp={handleRevokeApp}
              onUpdateBudget={handleUpdateBudget}
              onSetPassphrase={handleSetPassphrase}
              onLockVault={handleLockVault}
              onExportEncryptedBackup={handleExportEncryptedBackup}
              onResetDemoVault={() => void handleResetDemoVault()}
              onOpenCreateVault={(mode) =>
                setCreateVaultModal({ open: true, mode })
              }
              onGoogleSignIn={handleGoogleSignIn}
              onGoogleSignOut={handleGoogleSignOut}
              onScanGmailReceipts={handleScanGmailReceipts}
              onImportPaymentReceipts={handleImportPaymentReceipts}
              onImportCsvText={handleImportCsvText}
              onPushCloudVault={handlePushCloudVault}
              onPullCloudVault={handlePullCloudVault}
              onDeleteCloudVault={handleDeleteCloudVault}
              reminderSettings={reminderSettings}
              nightlySummary={nightlySummary}
              onEnableNightlyReminders={handleEnableNightlyReminders}
              onUpdateNightlyTime={handleUpdateNightlyTime}
              onSendNightlyPreview={handleSendNightlyPreview}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        apps={vault.apps}
        defaultDate={selectedDate}
        onClose={() => setIsAddExpenseOpen(false)}
        onSubmitExpense={handleAddManualExpense}
      />

      <EditExpenseModal
        expense={editingExpense}
        apps={vault.apps}
        onClose={() => setEditingExpense(null)}
        onSaveExpense={handleUpdateExpense}
      />

      <PermissionConsentModal
        app={pendingConsentApp}
        onClose={() => setPendingConsentApp(null)}
        onApprove={handleApproveApp}
      />

      <CreateVaultModal
        key={`${createVaultModal.open}-${createVaultModal.mode}`}
        isOpen={createVaultModal.open}
        initialMode={createVaultModal.mode}
        onClose={() => setCreateVaultModal((p) => ({ ...p, open: false }))}
        onCreateVault={handleCreatePersonalVault}
        onImportBackup={handleImportBackup}
      />

      <OfflineIndicator />
    </div>
  );
}
