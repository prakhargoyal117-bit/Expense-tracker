import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { Bell, CloudDownload, KeyRound, Lock, Menu, Plus, PlusCircle } from 'lucide-react';
import {
  type AppId,
  type ConnectedApp,
  type EncryptedVaultEnvelope,
  type ExpenseEntry,
  type ExpenseFilters,
  type ManualExpenseInput,
  type ProfileUpdateInput,
  type RecurringExpense,
  type ReminderPreferences,
  type VaultData,
} from './types/expense';
import {
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
  GOOGLE_SIGNIN_STALL_MS,
  GOOGLE_SIGNIN_TIMEOUT_MS,
  formatFirebaseAuthError,
  getStallSignInNotice,
  shouldOfferRedirectFallback,
} from './utils/authHelpers';
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
  decideCloudReconciliation,
  shouldForceGmailConsent,
} from './utils/vaultSync';
import {
  buildExpenseFromRecurring,
  computeRecurringSummary,
} from './utils/recurring';
import {
  type CloudVaultRecord,
  clearInMemoryGmailToken,
  consumeGoogleRedirectResult,
  deleteCloudEncryptedVault,
  fetchCloudEncryptedVault,
  getInMemoryGmailToken,
  initFirebaseAuth,
  resetPendingGoogleSignIn,
  saveCloudEncryptedVault,
  signInWithGoogleBasic,
  signInWithGoogleForVaultAndGmail,
  signInWithGoogleRedirectFallback,
  signOutGoogle,
  testFirestoreConnection,
} from './services/firebaseService';
import {
  GmailAuthError,
  type GmailScanScope,
  scanGmailOrderReceipts,
} from './services/gmailService';
import { Sidebar, type NavSection } from './components/Sidebar';
import { OverviewView } from './components/OverviewView';
import { AppInsightsView } from './components/AppInsightsView';
import { TransactionsView } from './components/TransactionsView';
import { AppsAndSecurityView } from './components/AppsAndSecurityView';
import { ProfileView } from './components/ProfileView';
import { AddExpenseModal } from './components/AddExpenseModal';
import { EditExpenseModal } from './components/EditExpenseModal';
import { PermissionConsentModal } from './components/PermissionConsentModal';
import { VaultLockScreen } from './components/VaultLockScreen';
import { VaultBootstrapSkeleton } from './components/VaultBootstrapSkeleton';
import { HomeMenuView } from './components/HomeMenuView';
import {
  CreateVaultModal,
  type NewPersonalVaultInput,
} from './components/CreateVaultModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';

const LEGACY_STORAGE_KEY = 'campusledger_e2ee_vault_v1';
const STORAGE_KEY = 'campusledger_e2ee_vault_v2';

const SECTION_TITLES: Record<NavSection, string> = {
  overview: 'Overview',
  insights: 'App Insights',
  transactions: 'Transactions',
  security: 'Apps & Sync',
  profile: 'Profile & Bills',
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
  const [showHomeMenu, setShowHomeMenu] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') !== '1';
  });

  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [selectedMonth, setSelectedMonth] = useState<string>(CURRENT_MONTH);
  const [selectedDate, setSelectedDate] = useState<string>(TODAY_DATE);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState<boolean>(false);
  const [addExpensePreset, setAddExpensePreset] = useState<'default' | 'irctc'>('default');
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
  const [isSigningInGoogle, setIsSigningInGoogle] = useState<boolean>(false);
  const [isRedirectingGoogle, setIsRedirectingGoogle] = useState<boolean>(false);
  const [showRedirectFallback, setShowRedirectFallback] = useState<boolean>(false);
  const [pendingRedirectScan, setPendingRedirectScan] = useState<boolean>(false);
  const [isSyncingGmail, setIsSyncingGmail] = useState<boolean>(false);
  const signInAttemptIdRef = useRef<number>(0);
  const signInStallTimerRef = useRef<number | null>(null);
  const signInTimeoutTimerRef = useRef<number | null>(null);

  const clearSignInTimers = useCallback(() => {
    if (signInStallTimerRef.current !== null) {
      window.clearTimeout(signInStallTimerRef.current);
      signInStallTimerRef.current = null;
    }
    if (signInTimeoutTimerRef.current !== null) {
      window.clearTimeout(signInTimeoutTimerRef.current);
      signInTimeoutTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearSignInTimers, [clearSignInTimers]);
  const [gmailStatus, setGmailStatus] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [appSyncStatus, setAppSyncStatus] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [syncingAppId, setSyncingAppId] = useState<AppId | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<string | null>(null);
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(null);
  const [isCloudBusy, setIsCloudBusy] = useState<boolean>(false);
  const [pendingCloudRecord, setPendingCloudRecord] =
    useState<CloudVaultRecord | null>(null);
  const [cloudBannerPassphrase, setCloudBannerPassphrase] = useState<string>('');
  const [cloudBannerError, setCloudBannerError] = useState<string | null>(null);
  const [isUnlockingCloudBanner, setIsUnlockingCloudBanner] =
    useState<boolean>(false);

  const vaultRef = useRef<VaultData | null>(null);
  const envelopeRef = useRef<EncryptedVaultEnvelope | null>(null);
  const googleUserRef = useRef<User | null>(null);
  const gmailMissingScopeRef = useRef<boolean>(false);
  const localPersistTimerRef = useRef<number | null>(null);
  const cloudPushTimerRef = useRef<number | null>(null);
  const reconciledUidRef = useRef<string | null>(null);

  useEffect(() => {
    vaultRef.current = vault;
  }, [vault]);

  useEffect(() => {
    envelopeRef.current = envelope;
  }, [envelope]);

  useEffect(() => {
    googleUserRef.current = googleUser;
  }, [googleUser]);

  const [filters, setFilters] = useState<ExpenseFilters>({
    month: CURRENT_MONTH,
    search: '',
    mode: 'all',
    appId: 'all',
    category: 'all',
  });

  const scheduleCloudAutoPush = useCallback(
    (uid: string, envToPush: EncryptedVaultEnvelope, immediate = false) => {
      if (cloudPushTimerRef.current !== null) {
        window.clearTimeout(cloudPushTimerRef.current);
        cloudPushTimerRef.current = null;
      }

      const runPush = async () => {
        try {
          await saveCloudEncryptedVault(uid, envToPush);
          const nowIso = new Date().toISOString();
          setLastCloudSyncAt(nowIso);
        } catch {
          // Non-fatal background sync error; user can retry manually in Apps & Security
        }
      };

      if (immediate) {
        void runPush();
      } else {
        cloudPushTimerRef.current = window.setTimeout(() => {
          cloudPushTimerRef.current = null;
          void runPush();
        }, 1200);
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (localPersistTimerRef.current !== null) {
        window.clearTimeout(localPersistTimerRef.current);
      }
      if (cloudPushTimerRef.current !== null) {
        window.clearTimeout(cloudPushTimerRef.current);
      }
    };
  }, []);

  const persistEncryptedVault = useCallback(
    async (
      nextVault: VaultData,
      passphrase: string,
      hasCustomPassphrase: boolean,
      options?: { skipCloudSync?: boolean; immediateCloud?: boolean },
    ): Promise<EncryptedVaultEnvelope> => {
      const nextEnvelope = await encryptVaultPayload(
        nextVault,
        passphrase,
        hasCustomPassphrase,
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEnvelope));
      setEnvelope(nextEnvelope);
      envelopeRef.current = nextEnvelope;
      const fp = await computeSha256Fingerprint(nextEnvelope.ciphertextBase64);
      setVaultFingerprint(fp);

      const signedInUser = googleUserRef.current;
      if (signedInUser && !options?.skipCloudSync) {
        scheduleCloudAutoPush(
          signedInUser.uid,
          nextEnvelope,
          Boolean(options?.immediateCloud),
        );
      }
      return nextEnvelope;
    },
    [scheduleCloudAutoPush],
  );

  const applyDecryptedVault = useCallback(
    async (
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
        envelopeRef.current = backupEnvelope;
        const fp = await computeSha256Fingerprint(backupEnvelope.ciphertextBase64);
        setVaultFingerprint(fp);
        const normalizedVault: VaultData = {
          ...decrypted,
          apps: mergeMissingApps(decrypted.apps),
        };
        setVault(normalizedVault);
        vaultRef.current = normalizedVault;
        setActivePassphrase(passphrase);
        setIsLocked(false);

        const months = getAvailableMonths(decrypted.expenses);
        const targetMonth = months[0] ?? CURRENT_MONTH;
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
    },
    [],
  );

  const reconcileWithCloudVault = useCallback(
    async (user: User) => {
      setIsCloudBusy(true);
      try {
        const record = await fetchCloudEncryptedVault(user.uid);
        const action = decideCloudReconciliation({
          localVault: vaultRef.current,
          localEnvelope: envelopeRef.current,
          cloudEnvelope: record?.envelope ?? null,
        });

        if (action === 'auto_pull_default' && record) {
          const ok = await applyDecryptedVault(
            record.envelope,
            DEFAULT_VAULT_PASSPHRASE,
          );
          if (ok) {
            setPendingCloudRecord(null);
            setLastCloudSyncAt(record.syncedAtIso);
            setCloudSyncStatus(
              `Synced your cloud vault for ${user.email} automatically.`,
            );
          } else {
            setPendingCloudRecord(record);
            setCloudSyncStatus(
              `Cloud vault found for ${user.email}. Enter your vault passphrase to open it on this browser.`,
            );
          }
        } else if (action === 'prompt_cloud_unlock' && record) {
          setPendingCloudRecord(record);
          setCloudBannerError(null);
          setCloudSyncStatus(
            `Cloud vault found for ${user.email} (created on another browser). Enter your vault passphrase to unlock and open it here.`,
          );
        } else if (action === 'auto_push_local' && envelopeRef.current) {
          setPendingCloudRecord(null);
          await saveCloudEncryptedVault(user.uid, envelopeRef.current);
          setLastCloudSyncAt(new Date().toISOString());
          setCloudSyncStatus(
            `Your local encrypted vault is now backed up to cloud for ${user.email} and ready on any browser.`,
          );
        } else if (record) {
          setPendingCloudRecord(null);
          setLastCloudSyncAt(record.syncedAtIso);
          setCloudSyncStatus(
            `Signed in as ${user.email}. Cloud encrypted vault is up to date.`,
          );
        }
      } catch {
        // Non-fatal: cloud check failed (e.g. offline); local vault still works
      } finally {
        setIsCloudBusy(false);
      }
    },
    [applyDecryptedVault],
  );

  // Initialize Firebase connection check, auth state listener, and redirect sign-in result
  useEffect(() => {
    void testFirestoreConnection();
    const unsub = initFirebaseAuth((user, token) => {
      setGoogleUser(user);
      googleUserRef.current = user;
      setHasGmailToken(Boolean(token));
      if (!user) {
        reconciledUidRef.current = null;
        setPendingCloudRecord(null);
      }
    });

    void consumeGoogleRedirectResult()
      .then((res) => {
        if (!res) return;
        setGoogleUser(res.user);
        googleUserRef.current = res.user;
        setHasGmailToken(Boolean(res.accessToken));
        setShowRedirectFallback(false);
        reconciledUidRef.current = res.user.uid;
        void reconcileWithCloudVault(res.user);
        if (res.intent === 'gmail') {
          setActiveSection('security');
          if (res.accessToken) {
            gmailMissingScopeRef.current = false;
            setPendingRedirectScan(true);
          } else {
            gmailMissingScopeRef.current = true;
            const missingMsg = `Signed in as ${res.user.email}, but Gmail read-only permission was not checked on the Google consent screen. You can still use Cloud Vault Sync and the IRCTC & Payment Receipt Reader.`;
            setGmailStatus({ type: 'error', text: missingMsg });
          }
        } else {
          setCloudSyncStatus(`Signed in as ${res.user.email}. Syncing encrypted vault...`);
        }
      })
      .catch((err) => {
        const host =
          typeof window !== 'undefined' ? window.location.hostname : undefined;
        const ua =
          typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
        const msg = formatFirebaseAuthError(err, host, ua);
        setActiveSection('security');
        setGmailStatus({ type: 'error', text: msg });
        setCloudSyncStatus(msg);
      });

    return () => unsub();
  }, [reconcileWithCloudVault]);

  // Automatically discover or sync cloud vault once bootstrap finishes and user is signed in
  useEffect(() => {
    if (isBootstrapping || !googleUser) return;
    if (reconciledUidRef.current === googleUser.uid) return;
    reconciledUidRef.current = googleUser.uid;
    void reconcileWithCloudVault(googleUser);
  }, [isBootstrapping, googleUser, reconcileWithCloudVault]);

  // Bootstrap encrypted vault from localStorage or initialize clean blank encrypted vault
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      // Remove legacy v1 demo vault so old pre-loaded Aarav Sharma sample data is wiped cleanly
      try {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        // Ignore storage restrictions
      }

      const params = new URLSearchParams(window.location.search);
      const autostart = params.get('autostart') === '1';

      const rawStored = localStorage.getItem(STORAGE_KEY);
      if (rawStored) {
        try {
          const parsed = JSON.parse(rawStored) as EncryptedVaultEnvelope;
          if (!cancelled) {
            setEnvelope(parsed);
            envelopeRef.current = parsed;
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
                const normalized = {
                  ...decrypted,
                  apps: mergeMissingApps(decrypted.apps),
                };
                setVault(normalized);
                vaultRef.current = normalized;
                setActivePassphrase(DEFAULT_VAULT_PASSPHRASE);
                setIsLocked(false);
                setIsBootstrapping(false);
              }
              return;
            } catch {
              if (!cancelled) {
                setVault(null);
                vaultRef.current = null;
                setIsLocked(true);
                setIsBootstrapping(false);
              }
              return;
            }
          } else {
            if (!cancelled) {
              setVault(null);
              vaultRef.current = null;
              setIsLocked(true);
              setIsBootstrapping(false);
            }
            return;
          }
        } catch {
          // Corrupted JSON in storage; re-initialize clean vault below
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
        vaultRef.current = initial;
        setEnvelope(initialEnvelope);
        envelopeRef.current = initialEnvelope;
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

  // Debounced local encryption + background cloud auto-sync so UI edits stay instant with zero lag
  const updateVault = useCallback(
    (updater: (prev: VaultData) => VaultData) => {
      setVault((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        vaultRef.current = next;

        if (localPersistTimerRef.current !== null) {
          window.clearTimeout(localPersistTimerRef.current);
        }
        const passSnapshot = activePassphrase;
        const customSnapshot = envelopeRef.current?.hasCustomPassphrase ?? false;
        localPersistTimerRef.current = window.setTimeout(() => {
          localPersistTimerRef.current = null;
          void persistEncryptedVault(next, passSnapshot, customSnapshot);
        }, 250);

        return next;
      });
    },
    [activePassphrase, persistEncryptedVault],
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

  const syncAppFromRealGmail = useCallback(
    async (appId: AppId, appName: string) => {
      const token = getInMemoryGmailToken();
      if (!token) {
        setHasGmailToken(false);
        setAppSyncStatus({
          type: 'error',
          text: `Gmail is not connected yet. Sign in with Google for Gmail above to pull real ${appName} receipts (no sample orders added).`,
        });
        return;
      }

      setSyncingAppId(appId);
      setAppSyncStatus(null);
      try {
        const scanScope: GmailScanScope =
          appId === 'upi_payment' ? 'payment_apps' : 'orders';
        const result = await scanGmailOrderReceipts(token, scanScope, appId);
        const nowIso = new Date().toISOString();
        let addedCount = 0;

        updateVault((prev) => {
          const existingIds = new Set(prev.expenses.map((e) => e.id));
          const freshEntries = result.importedEntries.filter(
            (e) => !existingIds.has(e.id),
          );
          addedCount = freshEntries.length;

          return {
            ...prev,
            apps: prev.apps.map((a) =>
              a.id === appId ? { ...a, lastSyncedAt: nowIso } : a,
            ),
            expenses: [...freshEntries, ...prev.expenses],
          };
        });

        setAppSyncStatus({
          type: addedCount > 0 ? 'success' : 'info',
          text:
            addedCount > 0
              ? `Synced ${addedCount} real ${appName} receipt(s) from ${result.scannedCount} Gmail message(s).`
              : `Checked ${result.scannedCount} Gmail message(s) for ${appName} · No new order receipts found.`,
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : `Unable to sync ${appName} receipts from Gmail.`;
        if (err instanceof GmailAuthError) {
          clearInMemoryGmailToken();
          setHasGmailToken(false);
          gmailMissingScopeRef.current =
            message.includes('403') ||
            message.toLowerCase().includes('permission was not checked');
          setGmailStatus({ type: 'error', text: message });
        }
        setAppSyncStatus({ type: 'error', text: message });
      } finally {
        setSyncingAppId(null);
      }
    },
    [updateVault],
  );

  const handleApproveApp = (
    app: ConnectedApp,
    accountHandle: string,
    grantedScopeIds: string[],
  ) => {
    const nowIso = new Date().toISOString();
    const token = getInMemoryGmailToken();

    updateVault((prev) => ({
      ...prev,
      apps: prev.apps.map((a) =>
        a.id === app.id
          ? {
              ...a,
              isConnected: true,
              connectedAt: nowIso,
              lastSyncedAt: token ? nowIso : null,
              accountHandle,
              scopes: a.scopes.map((s) => ({
                ...s,
                granted: grantedScopeIds.includes(s.id),
              })),
            }
          : a,
      ),
    }));

    setPendingConsentApp(null);

    if (token) {
      void syncAppFromRealGmail(app.id, app.name);
    } else {
      setAppSyncStatus({
        type: 'info',
        text: `${app.name} connected. No sample orders were added—sign in with Google for Gmail above or import CSV/receipts to pull your real ${app.name} orders.`,
      });
    }
  };

  const handleSyncApp = async (appId: AppId) => {
    const targetApp = vault?.apps.find((a) => a.id === appId);
    await syncAppFromRealGmail(appId, targetApp?.name ?? appId);
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

  const handleSaveProfile = (input: ProfileUpdateInput) => {
    updateVault((prev) => ({
      ...prev,
      studentName: input.displayName,
      campusName: input.profileLabel,
      monthlyBudget: input.monthlyBudget,
      savingsGoal: input.savingsGoal,
      avatarColor: input.avatarColor,
    }));
  };

  const handleAddRecurring = (
    bill: Omit<RecurringExpense, 'id' | 'lastLoggedMonth'>,
  ) => {
    const nextItem: RecurringExpense = {
      ...bill,
      id: `recbill-${Date.now()}`,
      lastLoggedMonth: null,
    };
    updateVault((prev) => ({
      ...prev,
      recurringExpenses: [nextItem, ...(prev.recurringExpenses ?? [])],
    }));
  };

  const handleLogRecurring = (bill: RecurringExpense) => {
    const targetMonth =
      selectedMonth === 'all' ? CURRENT_MONTH : selectedMonth;
    const entry = buildExpenseFromRecurring(bill, targetMonth);
    updateVault((prev) => ({
      ...prev,
      expenses: [entry, ...prev.expenses],
      recurringExpenses: (prev.recurringExpenses ?? []).map((b) =>
        b.id === bill.id ? { ...b, lastLoggedMonth: targetMonth } : b,
      ),
    }));
  };

  const handleDeleteRecurring = (id: string) => {
    updateVault((prev) => ({
      ...prev,
      recurringExpenses: (prev.recurringExpenses ?? []).filter((b) => b.id !== id),
    }));
  };

  const openAddExpenseModal = (preset: 'default' | 'irctc' = 'default') => {
    setAddExpensePreset(preset);
    setIsAddExpenseOpen(true);
  };

  const handleSetPassphrase = async (newPassphrase: string) => {
    if (!vault) return;
    await persistEncryptedVault(vault, newPassphrase, true, {
      immediateCloud: true,
    });
    setActivePassphrase(newPassphrase);
  };

  const handleLockVault = () => {
    if (localPersistTimerRef.current !== null && vaultRef.current) {
      window.clearTimeout(localPersistTimerRef.current);
      localPersistTimerRef.current = null;
      void persistEncryptedVault(
        vaultRef.current,
        activePassphrase,
        envelopeRef.current?.hasCustomPassphrase ?? false,
        { immediateCloud: true },
      );
    }
    setVault(null);
    vaultRef.current = null;
    setActivePassphrase('');
    setIsLocked(true);
    setShowHomeMenu(true);
  };

  const handleUnlockVault = async (passphrase: string): Promise<boolean> => {
    if (!envelope) return false;
    return applyDecryptedVault(envelope, passphrase);
  };

  const handleUnlockPendingCloudVault = async (
    passphrase: string,
  ): Promise<boolean> => {
    if (!pendingCloudRecord) return false;
    const ok = await applyDecryptedVault(pendingCloudRecord.envelope, passphrase);
    if (ok) {
      setLastCloudSyncAt(pendingCloudRecord.syncedAtIso);
      setPendingCloudRecord(null);
      setCloudBannerPassphrase('');
      setCloudBannerError(null);
      setCloudSyncStatus(
        'Cloud encrypted vault unlocked and synced to this browser.',
      );
    }
    return ok;
  };

  const handleCreateGmailInsidePassword = async (
    password: string,
  ): Promise<boolean> => {
    try {
      let targetVault = vaultRef.current;
      if (!targetVault && envelope && !envelope.hasCustomPassphrase) {
        const decrypted = await decryptVaultPayload<VaultData>(
          envelope,
          DEFAULT_VAULT_PASSPHRASE,
        );
        targetVault = {
          ...decrypted,
          apps: mergeMissingApps(decrypted.apps ?? []),
        };
      }
      if (!targetVault) {
        targetVault = createInitialVaultData();
      }
      const userDisplayName = googleUserRef.current?.displayName?.trim();
      if (userDisplayName && targetVault.studentName === 'Personal Vault') {
        targetVault = { ...targetVault, studentName: userDisplayName };
      }

      await persistEncryptedVault(targetVault, password, true, {
        immediateCloud: true,
      });
      setVault(targetVault);
      vaultRef.current = targetVault;
      setActivePassphrase(password);
      setIsLocked(false);
      setShowHomeMenu(false);
      setCloudSyncStatus(
        'Inside menu password saved and encrypted vault synced to your Google account.',
      );
      return true;
    } catch {
      return false;
    }
  };

  const handleUnlockWithGmailPassword = async (
    password: string,
  ): Promise<boolean> => {
    const ok = pendingCloudRecord
      ? await handleUnlockPendingCloudVault(password)
      : await handleUnlockVault(password);
    if (ok) {
      setShowHomeMenu(false);
    }
    return ok;
  };

  const handleUnlockWithVaultKey = async (vaultKey: string): Promise<boolean> => {
    const ok = await handleUnlockVault(vaultKey);
    if (ok) {
      setShowHomeMenu(false);
    }
    return ok;
  };

  const handleOpenLocalWorkspace = async () => {
    if (vaultRef.current && !isLocked) {
      setShowHomeMenu(false);
      return;
    }
    if (envelope && !envelope.hasCustomPassphrase) {
      const ok = await handleUnlockVault(DEFAULT_VAULT_PASSPHRASE);
      if (ok) {
        setShowHomeMenu(false);
        return;
      }
    }
    const clean = createInitialVaultData();
    await persistEncryptedVault(clean, DEFAULT_VAULT_PASSPHRASE, false, {
      skipCloudSync: true,
    });
    setVault(clean);
    vaultRef.current = clean;
    setActivePassphrase(DEFAULT_VAULT_PASSPHRASE);
    setIsLocked(false);
    setShowHomeMenu(false);
  };

  const handleWipeAllData = async () => {
    if (localPersistTimerRef.current !== null) {
      window.clearTimeout(localPersistTimerRef.current);
      localPersistTimerRef.current = null;
    }
    if (cloudPushTimerRef.current !== null) {
      window.clearTimeout(cloudPushTimerRef.current);
      cloudPushTimerRef.current = null;
    }

    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }

    const signedInUser = googleUserRef.current;
    if (signedInUser) {
      try {
        await deleteCloudEncryptedVault(signedInUser.uid);
        setLastCloudSyncAt(null);
      } catch {
        // Continue clearing local data even if cloud doc did not exist
      }
    }

    const clean = createInitialVaultData();
    await persistEncryptedVault(clean, DEFAULT_VAULT_PASSPHRASE, false, {
      skipCloudSync: true,
    });
    setVault(clean);
    vaultRef.current = clean;
    setActivePassphrase(DEFAULT_VAULT_PASSPHRASE);
    setPendingCloudRecord(null);
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
    setAppSyncStatus(null);
    setGmailStatus(null);
    setCloudSyncStatus(
      signedInUser
        ? 'All local and cloud vault data has been permanently deleted. Starting clean.'
        : 'All local vault data has been deleted. Starting clean.',
    );
  };

  // Create Personal Vault (blank by default)
  const handleCreatePersonalVault = async (input: NewPersonalVaultInput) => {
    const existingExpenses = vault?.expenses ?? [];
    const existingApps = vault?.apps ?? INITIAL_APPS;
    const freshVault: VaultData = {
      studentName: input.studentName,
      campusName: input.campusName,
      monthlyBudget: input.monthlyBudget,
      expenses: input.startBlank ? [] : existingExpenses,
      apps: input.startBlank
        ? INITIAL_APPS.map((a) => ({
            ...a,
            isConnected: false,
            connectedAt: null,
            lastSyncedAt: null,
            accountHandle: null,
            scopes: a.scopes.map((s) => ({ ...s, granted: false })),
          }))
        : existingApps,
    };

    const newEnv = await persistEncryptedVault(
      freshVault,
      input.passphrase,
      true,
      { skipCloudSync: true },
    );
    setVault(freshVault);
    vaultRef.current = freshVault;
    setActivePassphrase(input.passphrase);
    setPendingCloudRecord(null);
    setIsLocked(false);
    setShowHomeMenu(false);

    if (input.startBlank) {
      setSelectedMonth(CURRENT_MONTH);
      setFilters({
        month: CURRENT_MONTH,
        search: '',
        mode: 'all',
        appId: 'all',
        category: 'all',
      });
    }

    if (googleUserRef.current) {
      try {
        await saveCloudEncryptedVault(googleUserRef.current.uid, newEnv);
        setLastCloudSyncAt(new Date().toISOString());
        setCloudSyncStatus(
          'Personal encrypted vault created and synced to cloud for all browsers.',
        );
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
    const ok = await applyDecryptedVault(backupEnvelope, passphrase);
    if (ok) {
      setShowHomeMenu(false);
      if (googleUserRef.current) {
        scheduleCloudAutoPush(googleUserRef.current.uid, backupEnvelope, true);
      }
    }
    return ok;
  };

  // Scan Gmail order or payment-app receipts using in-memory OAuth token
  const handleScanGmailReceipts = async (
    scope: GmailScanScope = 'all',
    connectedEmailOverride?: string | null,
  ) => {
    const token = getInMemoryGmailToken();
    if (!token) {
      setHasGmailToken(false);
      setGmailStatus({
        type: 'error',
        text: 'Gmail session not authorized yet. Click "Re-authorize Gmail Access" and check the Gmail read-only permission box.',
      });
      return;
    }

    setIsSyncingGmail(true);
    const activeEmail = connectedEmailOverride ?? googleUser?.email;
    setGmailStatus({
      type: 'info',
      text: activeEmail
        ? `Connected ${activeEmail} · Scanning Gmail for receipts...`
        : 'Scanning Gmail for receipts...',
    });

    try {
      const result = await scanGmailOrderReceipts(token, scope);
      if (result.importedEntries.length === 0) {
        setGmailStatus({
          type: 'info',
          text:
            scope === 'payment_apps'
              ? `Connected${activeEmail ? ` (${activeEmail})` : ''} · Scanned ${result.scannedCount} recent email(s) · No new online payment app receipts found (OTPs, promos, and credits ignored).`
              : `Connected${activeEmail ? ` (${activeEmail})` : ''} · Scanned ${result.scannedCount} recent email(s) · No new EatSure, Zomato, Swiggy, Amazon, or UPI receipts found.`,
        });
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
                  accountHandle:
                    activeEmail ?? app.accountHandle ?? 'Gmail Sync',
                  scopes: app.scopes.map((s) => ({ ...s, granted: true })),
                }
              : app,
          ),
        };
      });

      setGmailStatus({
        type: addedCount > 0 ? 'success' : 'info',
        text:
          addedCount > 0
            ? `Connected${activeEmail ? ` (${activeEmail})` : ''} · Scanned ${result.scannedCount} emails · Imported ${addedCount} real receipt(s) into your encrypted vault.`
            : `Connected${activeEmail ? ` (${activeEmail})` : ''} · Scanned ${result.scannedCount} emails · All matching receipts are already in your vault.`,
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to scan Gmail receipts.';
      if (err instanceof GmailAuthError) {
        clearInMemoryGmailToken();
        setHasGmailToken(false);
        gmailMissingScopeRef.current =
          message.includes('403') ||
          message.toLowerCase().includes('permission was not checked');
      }
      setGmailStatus({
        type: 'error',
        text: message.startsWith('Gmail') ? message : `Gmail scan failed: ${message}`,
      });
    } finally {
      setIsSyncingGmail(false);
    }
  };

  // Universal Google Sign-In (NO restricted Gmail scopes — works for ANY Google user worldwide)
  const handleGoogleBasicSignIn = async () => {
    if (isSigningInGoogle || isRedirectingGoogle) return;
    clearSignInTimers();
    const attemptId = ++signInAttemptIdRef.current;

    setIsSigningInGoogle(true);
    setShowRedirectFallback(false);
    setCloudSyncStatus('Opening Google Sign-In window...');

    const ua =
      typeof navigator !== 'undefined' ? navigator.userAgent : undefined;

    signInStallTimerRef.current = window.setTimeout(() => {
      if (signInAttemptIdRef.current !== attemptId) return;
      setShowRedirectFallback(true);
      setCloudSyncStatus(getStallSignInNotice(ua));
    }, GOOGLE_SIGNIN_STALL_MS);

    signInTimeoutTimerRef.current = window.setTimeout(() => {
      if (signInAttemptIdRef.current !== attemptId) return;
      signInAttemptIdRef.current += 1;
      clearSignInTimers();
      resetPendingGoogleSignIn();
      setIsSigningInGoogle(false);
      setShowRedirectFallback(true);
      setCloudSyncStatus(
        'Google Sign-In window timed out without responding. Tap "Try Full-Page Redirect Sign-In" below, or allow popups for this site and try again.',
      );
    }, GOOGLE_SIGNIN_TIMEOUT_MS);

    try {
      const { user } = await signInWithGoogleBasic({
        loginHint: googleUserRef.current?.email ?? undefined,
      });
      if (signInAttemptIdRef.current !== attemptId) return;
      clearSignInTimers();
      setGoogleUser(user);
      googleUserRef.current = user;
      setShowRedirectFallback(false);

      // Personalize default profile name automatically on first sign-in
      if (
        user.displayName &&
        vaultRef.current &&
        (vaultRef.current.studentName === 'Personal Vault' ||
          vaultRef.current.studentName === 'My Personal Vault')
      ) {
        updateVault((prev) => ({
          ...prev,
          studentName: user.displayName || prev.studentName,
        }));
      }

      reconciledUidRef.current = user.uid;
      await reconcileWithCloudVault(user);
    } catch (err) {
      if (signInAttemptIdRef.current !== attemptId) return;
      clearSignInTimers();
      const host =
        typeof window !== 'undefined' ? window.location.hostname : undefined;
      const msg = formatFirebaseAuthError(err, host, ua);
      setShowRedirectFallback(shouldOfferRedirectFallback(err));
      setCloudSyncStatus(msg);
    } finally {
      if (signInAttemptIdRef.current === attemptId) {
        clearSignInTimers();
        setIsSigningInGoogle(false);
      }
    }
  };

  const handleGoogleBasicRedirectSignIn = async () => {
    if (isRedirectingGoogle) return;
    signInAttemptIdRef.current += 1;
    clearSignInTimers();
    resetPendingGoogleSignIn();
    setIsSigningInGoogle(false);
    setIsRedirectingGoogle(true);
    setCloudSyncStatus('Redirecting to Google Sign-In...');
    try {
      await signInWithGoogleRedirectFallback({
        includeGmailScope: false,
        loginHint: googleUserRef.current?.email ?? undefined,
      });
    } catch (err) {
      const host =
        typeof window !== 'undefined' ? window.location.hostname : undefined;
      const ua =
        typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
      const msg = formatFirebaseAuthError(err, host, ua);
      setCloudSyncStatus(msg);
      setIsRedirectingGoogle(false);
    }
  };

  // Optional Gmail Auto-Scan OAuth upgrade (separate from standard Google Sign-In)
  const handleGoogleSignIn = async (scanScope: GmailScanScope = 'all') => {
    if (isSigningInGoogle || isRedirectingGoogle) return;
    clearSignInTimers();
    const attemptId = ++signInAttemptIdRef.current;

    setIsSigningInGoogle(true);
    setShowRedirectFallback(false);
    setGmailStatus({
      type: 'info',
      text: 'Opening Google consent window for optional Gmail receipt scan...',
    });
    setAppSyncStatus(null);

    const ua =
      typeof navigator !== 'undefined' ? navigator.userAgent : undefined;

    signInStallTimerRef.current = window.setTimeout(() => {
      if (signInAttemptIdRef.current !== attemptId) return;
      setShowRedirectFallback(true);
      setGmailStatus({
        type: 'info',
        text: getStallSignInNotice(ua),
      });
    }, GOOGLE_SIGNIN_STALL_MS);

    signInTimeoutTimerRef.current = window.setTimeout(() => {
      if (signInAttemptIdRef.current !== attemptId) return;
      signInAttemptIdRef.current += 1;
      clearSignInTimers();
      resetPendingGoogleSignIn();
      setIsSigningInGoogle(false);
      setShowRedirectFallback(true);
      const timeoutMsg =
        'Google Sign-In window timed out without responding. Tap "Try Full-Page Redirect Sign-In Instead" below, or allow popups for this site and try again.';
      setGmailStatus({ type: 'error', text: timeoutMsg });
    }, GOOGLE_SIGNIN_TIMEOUT_MS);

    try {
      const forceConsent = shouldForceGmailConsent({
        missingScopeFromLastAttempt: gmailMissingScopeRef.current,
      });
      const { user, accessToken } = await signInWithGoogleForVaultAndGmail({
        forceConsent,
        includeGmailScope: true,
        loginHint: googleUserRef.current?.email ?? undefined,
      });
      if (signInAttemptIdRef.current !== attemptId) return;
      clearSignInTimers();
      setGoogleUser(user);
      googleUserRef.current = user;
      setHasGmailToken(Boolean(accessToken));
      setShowRedirectFallback(false);

      reconciledUidRef.current = user.uid;
      await reconcileWithCloudVault(user);

      if (accessToken) {
        gmailMissingScopeRef.current = false;
        if (vaultRef.current && !isLocked) {
          await handleScanGmailReceipts(scanScope, user.email);
        }
      } else {
        gmailMissingScopeRef.current = true;
        const missingMsg = `Signed in as ${user.email}, but Gmail read-only permission was not granted. Your Cloud Vault Sync still works—use the IRCTC & Payment Receipt Reader or try Connect Gmail Auto-Scan again.`;
        setGmailStatus({ type: 'error', text: missingMsg });
      }
    } catch (err) {
      if (signInAttemptIdRef.current !== attemptId) return;
      clearSignInTimers();
      const host =
        typeof window !== 'undefined' ? window.location.hostname : undefined;
      const msg = formatFirebaseAuthError(err, host, ua);
      setShowRedirectFallback(shouldOfferRedirectFallback(err));
      setGmailStatus({ type: 'error', text: msg });
    } finally {
      if (signInAttemptIdRef.current === attemptId) {
        clearSignInTimers();
        setIsSigningInGoogle(false);
      }
    }
  };

  const handleCancelGoogleSignIn = useCallback(() => {
    signInAttemptIdRef.current += 1;
    clearSignInTimers();
    resetPendingGoogleSignIn();
    setIsSigningInGoogle(false);
    setIsRedirectingGoogle(false);
    setShowRedirectFallback(true);
    setGmailStatus({
      type: 'info',
      text: 'Google Sign-In canceled. You can retry the popup or use "Try Full-Page Redirect Sign-In Instead" below.',
    });
    setCloudSyncStatus('Google Sign-In canceled.');
  }, [clearSignInTimers]);

  const handleGoogleRedirectSignIn = async () => {
    if (isRedirectingGoogle) return;
    signInAttemptIdRef.current += 1;
    clearSignInTimers();
    resetPendingGoogleSignIn();
    setIsSigningInGoogle(false);
    setIsRedirectingGoogle(true);
    setGmailStatus({
      type: 'info',
      text: 'Redirecting to Google Sign-In...',
    });
    try {
      await signInWithGoogleRedirectFallback({
        includeGmailScope: true,
        forceConsent: gmailMissingScopeRef.current,
        loginHint: googleUserRef.current?.email ?? undefined,
      });
    } catch (err) {
      const host =
        typeof window !== 'undefined' ? window.location.hostname : undefined;
      const ua =
        typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
      const msg = formatFirebaseAuthError(err, host, ua);
      setGmailStatus({ type: 'error', text: msg });
      setIsRedirectingGoogle(false);
    }
  };

  useEffect(() => {
    if (!pendingRedirectScan || isBootstrapping || isLocked || !vault) return;
    setPendingRedirectScan(false);
    void handleScanGmailReceipts('all', googleUser?.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRedirectScan, isBootstrapping, isLocked, vault]);

  const handleGoogleSignOut = async () => {
    await signOutGoogle();
    setGoogleUser(null);
    setHasGmailToken(false);
    setShowRedirectFallback(false);
    setGmailStatus(null);
    setAppSyncStatus(null);
    setCloudSyncStatus(null);
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
    link.download = `spendvault-encrypted-vault-${TODAY_DATE}.json`;
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
    link.download = `spendvault-expenses-${selectedMonth}.csv`;
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
    const refDays =
      selectedMonth === CURRENT_MONTH ? new Date().getDate() : undefined;
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
        return 'Browser notification permission is blocked—in-app nightly check-in prompts will still appear when you open SpendVault.';
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

  if (showHomeMenu) {
    return (
      <>
        <HomeMenuView
          googleUser={googleUser}
          hasLocalCustomKey={Boolean(envelope?.hasCustomPassphrase)}
          hasCloudCustomVault={Boolean(pendingCloudRecord)}
          isVaultUnlockedInSession={Boolean(vault) && !isLocked}
          isBootstrapping={isBootstrapping}
          isSigningInGoogle={isSigningInGoogle}
          isRedirectingGoogle={isRedirectingGoogle}
          showRedirectFallback={showRedirectFallback}
          cloudStatus={cloudSyncStatus}
          onGoogleSignIn={handleGoogleBasicSignIn}
          onGoogleRedirectSignIn={handleGoogleBasicRedirectSignIn}
          onCancelGoogleSignIn={handleCancelGoogleSignIn}
          onGoogleSignOut={handleGoogleSignOut}
          onCreateGmailInsidePassword={handleCreateGmailInsidePassword}
          onUnlockWithGmailPassword={handleUnlockWithGmailPassword}
          onUnlockWithVaultKey={handleUnlockWithVaultKey}
          onOpenLocalWorkspace={handleOpenLocalWorkspace}
          onContinueToInsideMenu={() => setShowHomeMenu(false)}
          onLockVault={handleLockVault}
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

  if (isBootstrapping) {
    return <VaultBootstrapSkeleton statusText="Decrypting AES-256-GCM vault..." />;
  }

  if (isLocked || !vault || !summary) {
    return (
      <>
        <VaultLockScreen
          envelope={pendingCloudRecord?.envelope ?? envelope}
          googleUser={googleUser}
          isSigningInGoogle={isSigningInGoogle}
          isRedirectingGoogle={isRedirectingGoogle}
          showRedirectFallback={showRedirectFallback}
          cloudVaultAvailable={Boolean(pendingCloudRecord)}
          cloudStatus={cloudSyncStatus}
          onUnlock={handleUnlockVault}
          onUnlockCloudVault={handleUnlockPendingCloudVault}
          onGoogleSignIn={handleGoogleBasicSignIn}
          onGoogleRedirectSignIn={handleGoogleBasicRedirectSignIn}
          onCancelGoogleSignIn={handleCancelGoogleSignIn}
          onWipeAllData={handleWipeAllData}
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
  const recurringExpenses = vault.recurringExpenses ?? [];
  const effectiveMonthForRecurring =
    selectedMonth === 'all' ? CURRENT_MONTH : selectedMonth;
  const pendingRecurringCount = computeRecurringSummary(
    recurringExpenses,
    effectiveMonthForRecurring,
  ).pendingCount;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar
        activeSection={activeSection}
        onNavigate={(section) => {
          setActiveSection(section);
          window.scrollTo({ top: 0, behavior: 'auto' });
        }}
        onGoHome={() => {
          setShowHomeMenu(true);
          window.scrollTo({ top: 0, behavior: 'auto' });
        }}
        displayName={vault.studentName}
        profileLabel={vault.campusName}
        avatarColor={vault.avatarColor ?? '#0F766E'}
        avatarUrl={googleUser?.photoURL ?? null}
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
              <span className="text-slate-400 hidden sm:inline">SpendVault</span>
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
              onClick={() => openAddExpenseModal('default')}
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
          {pendingCloudRecord && googleUser && (
            <section
              role="region"
              aria-label="Unlock Cloud Vault"
              data-testid="cloud-vault-unlock-banner"
              className="bg-white border border-teal-300 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs"
            >
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800 shrink-0 mt-0.5">
                  <CloudDownload className="w-4 h-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Encrypted Cloud Vault Found for {googleUser.email}
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Enter the passphrase you created on your other browser (e.g. Brave) to decrypt and open your vault here.
                  </p>
                  {cloudBannerError && (
                    <p role="alert" className="text-xs font-medium text-red-700 mt-1">
                      {cloudBannerError}
                    </p>
                  )}
                </div>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setCloudBannerError(null);
                  if (!cloudBannerPassphrase.trim()) {
                    setCloudBannerError('Enter your vault passphrase.');
                    return;
                  }
                  setIsUnlockingCloudBanner(true);
                  const ok = await handleUnlockPendingCloudVault(
                    cloudBannerPassphrase,
                  );
                  setIsUnlockingCloudBanner(false);
                  if (!ok) {
                    setCloudBannerError(
                      'Incorrect passphrase. Try the passphrase you set when creating your vault.',
                    );
                  }
                }}
                className="flex flex-wrap items-center gap-2 shrink-0"
              >
                <div className="relative">
                  <KeyRound
                    className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <label htmlFor="banner-cloud-passphrase" className="sr-only">
                    Cloud vault passphrase
                  </label>
                  <input
                    id="banner-cloud-passphrase"
                    type="password"
                    value={cloudBannerPassphrase}
                    onChange={(e) => {
                      setCloudBannerPassphrase(e.target.value);
                      setCloudBannerError(null);
                    }}
                    placeholder="Vault passphrase"
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isUnlockingCloudBanner}
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  {isUnlockingCloudBanner ? 'Unlocking...' : 'Open Cloud Vault'}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingCloudRecord(null)}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Dismiss
                </button>
              </form>
            </section>
          )}

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
              pendingRecurringCount={pendingRecurringCount}
              onNavigate={setActiveSection}
              onOpenAddExpense={openAddExpenseModal}
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
              onOpenAddExpense={() => openAddExpenseModal('default')}
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
              isSigningInGoogle={isSigningInGoogle}
              isRedirectingGoogle={isRedirectingGoogle}
              showRedirectFallback={showRedirectFallback}
              isSyncingGmail={isSyncingGmail}
              gmailStatus={gmailStatus}
              appSyncStatus={appSyncStatus}
              syncingAppId={syncingAppId}
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
              onWipeAllData={handleWipeAllData}
              onOpenCreateVault={(mode) =>
                setCreateVaultModal({ open: true, mode })
              }
              onGoogleBasicSignIn={handleGoogleBasicSignIn}
              onGoogleBasicRedirectSignIn={handleGoogleBasicRedirectSignIn}
              onGoogleSignIn={handleGoogleSignIn}
              onGoogleRedirectSignIn={handleGoogleRedirectSignIn}
              onCancelGoogleSignIn={handleCancelGoogleSignIn}
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

          {activeSection === 'profile' && (
            <ProfileView
              displayName={vault.studentName}
              profileLabel={vault.campusName}
              monthlyBudget={vault.monthlyBudget}
              savingsGoal={vault.savingsGoal ?? 5000}
              avatarColor={vault.avatarColor ?? '#0F766E'}
              monthlySpend={summary.totalSpend}
              selectedMonth={selectedMonth}
              apps={vault.apps}
              recurringExpenses={recurringExpenses}
              googleUser={googleUser}
              isSigningInGoogle={isSigningInGoogle}
              isRedirectingGoogle={isRedirectingGoogle}
              showRedirectFallback={showRedirectFallback}
              cloudSyncStatus={cloudSyncStatus}
              lastCloudSyncAt={lastCloudSyncAt}
              onSaveProfile={handleSaveProfile}
              onAddRecurring={handleAddRecurring}
              onLogRecurring={handleLogRecurring}
              onDeleteRecurring={handleDeleteRecurring}
              onGoogleBasicSignIn={handleGoogleBasicSignIn}
              onGoogleBasicRedirectSignIn={handleGoogleBasicRedirectSignIn}
              onCancelGoogleSignIn={handleCancelGoogleSignIn}
              onGoogleSignOut={handleGoogleSignOut}
              onLockVault={handleLockVault}
              onOpenCreateVault={(mode) =>
                setCreateVaultModal({ open: true, mode })
              }
            />
          )}
        </main>

        <footer className="mt-auto border-t border-slate-200 bg-white/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500">
            <p className="leading-relaxed">
              <strong className="font-semibold text-slate-700">SpendVault</strong> — Private personal finance, IRCTC
              ticket &amp; payment receipt vault with client-side AES-256-GCM encryption. Use without login or sync
              optionally with Google.
            </p>
            <div className="flex items-center gap-4 shrink-0">
              <a
                href="/privacy.html"
                className="font-medium text-teal-800 hover:text-teal-950 hover:underline"
              >
                Privacy Policy
              </a>
              <a
                href="/terms.html"
                className="font-medium text-slate-600 hover:text-slate-900 hover:underline"
              >
                Terms of Service
              </a>
            </div>
          </div>
        </footer>
      </div>

      {/* Modals */}
      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        apps={vault.apps}
        defaultDate={selectedDate}
        initialPreset={addExpensePreset}
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
        defaultAccountHandle={googleUser?.email ?? ''}
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
