import { useEffect, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowRight,
  Cloud,
  FileUp,
  KeyRound,
  Lock,
  LogOut,
  PlusCircle,
  ShieldCheck,
} from 'lucide-react';
import { GoogleSignInButton } from './GoogleSignInButton';
import { SpendVaultLogo } from './SpendVaultLogo';
import {
  resolveAccessGateState,
  validateInsidePasswordSetup,
  validateVaultKeyInput,
} from '../utils/accessGate';

interface HomeMenuViewProps {
  googleUser: User | null;
  hasLocalCustomKey: boolean;
  hasCloudCustomVault: boolean;
  isVaultUnlockedInSession: boolean;
  isBootstrapping: boolean;
  isSigningInGoogle: boolean;
  isRedirectingGoogle: boolean;
  showRedirectFallback: boolean;
  cloudStatus: string | null;
  onGoogleSignIn: () => Promise<void>;
  onGoogleRedirectSignIn: () => Promise<void>;
  onCancelGoogleSignIn: () => void;
  onGoogleSignOut: () => Promise<void>;
  onCreateGmailInsidePassword: (password: string) => Promise<boolean>;
  onUnlockWithGmailPassword: (password: string) => Promise<boolean>;
  onUnlockWithVaultKey: (vaultKey: string) => Promise<boolean>;
  onOpenLocalWorkspace: () => Promise<void>;
  onContinueToInsideMenu: () => void;
  onLockVault: () => void;
  onOpenCreateVault: (mode: 'create' | 'import') => void;
}

export function HomeMenuView({
  googleUser,
  hasLocalCustomKey,
  hasCloudCustomVault,
  isVaultUnlockedInSession,
  isBootstrapping,
  isSigningInGoogle,
  isRedirectingGoogle,
  showRedirectFallback,
  cloudStatus,
  onGoogleSignIn,
  onGoogleRedirectSignIn,
  onCancelGoogleSignIn,
  onGoogleSignOut,
  onCreateGmailInsidePassword,
  onUnlockWithGmailPassword,
  onUnlockWithVaultKey,
  onOpenLocalWorkspace,
  onContinueToInsideMenu,
  onLockVault,
  onOpenCreateVault,
}: HomeMenuViewProps) {
  const accessState = resolveAccessGateState({
    isSignedInWithGoogle: Boolean(googleUser),
    hasLocalCustomKey,
    hasCloudCustomVault,
    isVaultUnlockedInSession,
  });

  const [activeTab, setActiveTab] = useState<'gmail' | 'vault'>(
    accessState.recommendedTab,
  );

  // Gmail Inside Menu Password form state
  const [gmailPassword, setGmailPassword] = useState('');
  const [gmailConfirmPassword, setGmailConfirmPassword] = useState('');
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [isSubmittingGmail, setIsSubmittingGmail] = useState(false);

  // Vault Key form state
  const [vaultKey, setVaultKey] = useState('');
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [isSubmittingVault, setIsSubmittingVault] = useState(false);

  // Automatically switch to Gmail tab right after a user finishes Google Sign-In
  useEffect(() => {
    if (googleUser) {
      setActiveTab('gmail');
    }
  }, [googleUser]);

  const handleGmailCreatePassword = async (e: FormEvent) => {
    e.preventDefault();
    setGmailError(null);
    const validationErr = validateInsidePasswordSetup(
      gmailPassword,
      gmailConfirmPassword,
    );
    if (validationErr) {
      setGmailError(validationErr);
      return;
    }

    setIsSubmittingGmail(true);
    const ok = await onCreateGmailInsidePassword(gmailPassword);
    setIsSubmittingGmail(false);
    if (!ok) {
      setGmailError('Could not save your inside menu password. Please try again.');
      return;
    }
    setGmailPassword('');
    setGmailConfirmPassword('');
  };

  const handleGmailEnterPassword = async (e: FormEvent) => {
    e.preventDefault();
    setGmailError(null);
    if (!gmailPassword.trim()) {
      setGmailError('Enter your inside menu password to continue.');
      return;
    }

    setIsSubmittingGmail(true);
    const ok = await onUnlockWithGmailPassword(gmailPassword);
    setIsSubmittingGmail(false);
    if (!ok) {
      setGmailError(
        'Incorrect inside menu password. Check your password and try again.',
      );
      return;
    }
    setGmailPassword('');
  };

  const handleVaultKeyUnlock = async (e: FormEvent) => {
    e.preventDefault();
    setVaultError(null);
    const validationErr = validateVaultKeyInput(vaultKey);
    if (validationErr) {
      setVaultError(validationErr);
      return;
    }

    setIsSubmittingVault(true);
    const ok = await onUnlockWithVaultKey(vaultKey);
    setIsSubmittingVault(false);
    if (!ok) {
      setVaultError(
        'Invalid vault key. AES-256-GCM decryption failed—check your key and retry.',
      );
      return;
    }
    setVaultKey('');
  };

  const scrollToAccessHub = () => {
    const el = document.getElementById('access-portal');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0"
          >
            <SpendVaultLogo size={32} />
            <span className="text-[17px] font-bold tracking-tight text-slate-900">
              SpendVault
            </span>
          </a>

          <nav
            aria-label="Home menu navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
          >
            <a
              href="#capabilities"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <a
              href="#how-access-works"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              How Access Works
            </a>
            <a
              href="/privacy.html"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Privacy Policy
            </a>
            <a
              href="/terms.html"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Terms
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={
                accessState.gmailStep === 'unlocked_ready' ||
                accessState.vaultStep === 'unlocked_ready'
                  ? onContinueToInsideMenu
                  : scrollToAccessHub
              }
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {accessState.gmailStep === 'unlocked_ready' ||
              accessState.vaultStep === 'unlocked_ready'
                ? 'Open Inside Menu'
                : 'Unlock Workspace'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero & Dual Access Portal */}
        <section
          aria-label="SpendVault Home Menu and Access Portal"
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 lg:pt-16 lg:pb-20"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            {/* Left Column: Clear Purpose & Value Proposition */}
            <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
              <p className="text-xs font-semibold text-teal-800 tracking-normal">
                Personal Finance · IRCTC Rail Tracker · AES-256-GCM Encrypted Vault
              </p>

              <h1
                className="font-bold tracking-tight text-slate-900 leading-[1.12]"
                style={{
                  fontSize: 'clamp(2.1rem, 3.6vw, 3.2rem)',
                  textWrap: 'balance',
                }}
              >
                One private home for every UPI payment, IRCTC ticket, and cash expense.
              </h1>

              <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
                SpendVault tracks monthly budgets, Safe Daily Allowance, recurring bills,
                IRCTC e-tickets (PNR &amp; train numbers), and receipts from EatSure, Zomato,
                Swiggy, Amazon, PhonePe, Google Pay, and Paytm. Every record is encrypted
                inside your browser before saving or syncing.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 max-w-2xl">
                <div className="border-t border-slate-200 pt-3.5">
                  <p className="text-sm font-semibold text-slate-900">
                    Google / Gmail Login + Inside Password
                  </p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Sign in with any Google account to sync across Brave, Chrome, and mobile,
                    protected by your personal Inside Menu password.
                  </p>
                </div>
                <div className="border-t border-slate-200 pt-3.5">
                  <p className="text-sm font-semibold text-slate-900">
                    Direct Vault Key Access
                  </p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Prefer no cloud account? Create a local encrypted vault and unlock the
                    inside menu directly with your personal Vault Key.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Dual-Mode Access Hub */}
            <div
              id="access-portal"
              data-testid="home-access-portal"
              className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 sm:p-7 flex flex-col justify-between"
            >
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Enter Inside Menu
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Choose how you want to open your SpendVault workspace.
                  </p>
                </div>

                {/* Segmented Mode Switcher */}
                <div
                  role="tablist"
                  aria-label="Workspace unlock method"
                  className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg"
                >
                  <button
                    type="button"
                    role="tab"
                    data-testid="home-tab-gmail"
                    aria-selected={activeTab === 'gmail'}
                    onClick={() => {
                      setActiveTab('gmail');
                      setVaultError(null);
                    }}
                    className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                      activeTab === 'gmail'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Google / Gmail
                  </button>
                  <button
                    type="button"
                    role="tab"
                    data-testid="home-tab-vault"
                    aria-selected={activeTab === 'vault'}
                    onClick={() => {
                      setActiveTab('vault');
                      setGmailError(null);
                    }}
                    className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                      activeTab === 'vault'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Vault Key
                  </button>
                </div>

                {cloudStatus && (
                  <p
                    role="status"
                    className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5"
                  >
                    {cloudStatus}
                  </p>
                )}

                {isBootstrapping ? (
                  <div className="py-6 space-y-3" aria-live="polite">
                    <div className="h-4 w-40 bg-slate-200/80 rounded animate-pulse" />
                    <div className="h-10 w-full bg-slate-100 rounded-lg animate-pulse" />
                    <div className="h-10 w-full bg-slate-200/70 rounded-lg animate-pulse" />
                  </div>
                ) : activeTab === 'gmail' ? (
                  /* ==================== GMAIL / GOOGLE TAB ==================== */
                  <div className="space-y-4">
                    {accessState.gmailStep === 'sign_in' && (
                      <>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Step 1: Sign in with your Google / Gmail account. Step 2: Enter or
                          create your personal <strong>Inside Menu Password</strong> to open
                          your encrypted dashboard.
                        </p>

                        <div className="space-y-2.5 pt-1">
                          <GoogleSignInButton
                            disabled={isSigningInGoogle || isRedirectingGoogle}
                            onClick={() => void onGoogleSignIn()}
                            label={
                              isRedirectingGoogle
                                ? 'Redirecting to Google...'
                                : isSigningInGoogle
                                  ? 'Waiting for Google Sign-In...'
                                  : 'Sign in with Google'
                            }
                          />

                          <div className="flex flex-wrap items-center gap-2">
                            {showRedirectFallback && (
                              <button
                                type="button"
                                disabled={isRedirectingGoogle}
                                onClick={() => void onGoogleRedirectSignIn()}
                                className="px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors"
                              >
                                Try Redirect Sign-In
                              </button>
                            )}
                            {isSigningInGoogle && (
                              <button
                                type="button"
                                onClick={onCancelGoogleSignIn}
                                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Open to every Google account. Basic sign-in syncs your encrypted
                          vault without requesting Gmail inbox permissions.
                        </p>
                      </>
                    )}

                    {accessState.gmailStep !== 'sign_in' && googleUser && (
                      <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {googleUser.photoURL ? (
                            <img
                              src={googleUser.photoURL}
                              alt={googleUser.displayName ?? 'Google user'}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <span className="w-8 h-8 rounded-lg bg-teal-700 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                              {(googleUser.email?.[0] ?? 'G').toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {googleUser.displayName ?? 'Google Account'}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {googleUser.email}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void onGoogleSignOut()}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 shrink-0"
                        >
                          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Sign out</span>
                        </button>
                      </div>
                    )}

                    {accessState.gmailStep === 'create_password' && (
                      <form
                        onSubmit={handleGmailCreatePassword}
                        className="space-y-3.5"
                        data-testid="home-gmail-create-password-form"
                      >
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Create an <strong>Inside Menu Password</strong> for this Gmail
                          account. You will use this password to unlock your dashboard on any
                          browser.
                        </p>

                        <div>
                          <label
                            htmlFor="home-gmail-new-password"
                            className="block text-xs font-medium text-slate-700 mb-1"
                          >
                            Inside Menu Password
                          </label>
                          <div className="relative">
                            <Lock
                              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                              aria-hidden="true"
                            />
                            <input
                              id="home-gmail-new-password"
                              data-testid="home-gmail-new-password"
                              type="password"
                              value={gmailPassword}
                              onChange={(e) => {
                                setGmailPassword(e.target.value);
                                setGmailError(null);
                              }}
                              placeholder="Minimum 6 characters"
                              className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                            />
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor="home-gmail-confirm-password"
                            className="block text-xs font-medium text-slate-700 mb-1"
                          >
                            Confirm Password
                          </label>
                          <input
                            id="home-gmail-confirm-password"
                            data-testid="home-gmail-confirm-password"
                            type="password"
                            value={gmailConfirmPassword}
                            onChange={(e) => {
                              setGmailConfirmPassword(e.target.value);
                              setGmailError(null);
                            }}
                            placeholder="Re-enter inside menu password"
                            className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                          />
                        </div>

                        {gmailError && (
                          <p role="alert" className="text-xs font-medium text-red-700">
                            {gmailError}
                          </p>
                        )}

                        <button
                          type="submit"
                          disabled={isSubmittingGmail}
                          data-testid="home-gmail-save-password-btn"
                          className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <span>
                            {isSubmittingGmail
                              ? 'Encrypting & Opening...'
                              : 'Save Password & Open Inside Menu'}
                          </span>
                          <ArrowRight className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </form>
                    )}

                    {accessState.gmailStep === 'enter_password' && (
                      <form
                        onSubmit={handleGmailEnterPassword}
                        className="space-y-3.5"
                        data-testid="home-gmail-unlock-form"
                      >
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Enter your <strong>Inside Menu Password</strong> to decrypt and open
                          your synced SpendVault workspace.
                        </p>

                        <div>
                          <label
                            htmlFor="home-gmail-password"
                            className="block text-xs font-medium text-slate-700 mb-1"
                          >
                            Inside Menu Password
                          </label>
                          <div className="relative">
                            <Lock
                              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                              aria-hidden="true"
                            />
                            <input
                              id="home-gmail-password"
                              data-testid="home-gmail-password-input"
                              type="password"
                              value={gmailPassword}
                              onChange={(e) => {
                                setGmailPassword(e.target.value);
                                setGmailError(null);
                              }}
                              placeholder="Enter your inside menu password"
                              autoFocus
                              className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                            />
                          </div>
                          {gmailError && (
                            <p role="alert" className="mt-1.5 text-xs font-medium text-red-700">
                              {gmailError}
                            </p>
                          )}
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmittingGmail}
                          data-testid="home-gmail-unlock-btn"
                          className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                          <span>
                            {isSubmittingGmail
                              ? 'Verifying Password...'
                              : 'Verify Password & Open Inside Menu'}
                          </span>
                        </button>
                      </form>
                    )}

                    {accessState.gmailStep === 'unlocked_ready' && (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Your Gmail-synced vault is unlocked for this session. Continue to
                          the inside menu or lock it to require your password again.
                        </p>
                        <button
                          type="button"
                          onClick={onContinueToInsideMenu}
                          data-testid="home-continue-inside-btn"
                          className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <span>Continue to Inside Menu</span>
                          <ArrowRight className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={onLockVault}
                          className="w-full py-2 px-4 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5"
                        >
                          <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Lock &amp; Require Password</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ==================== VAULT KEY TAB ==================== */
                  <div className="space-y-4">
                    {accessState.vaultStep === 'unlock_key' && (
                      <form
                        onSubmit={handleVaultKeyUnlock}
                        className="space-y-3.5"
                        data-testid="home-vault-key-form"
                      >
                        <p className="text-xs text-slate-600 leading-relaxed">
                          An encrypted personal vault is stored on this device. Enter its{' '}
                          <strong>Vault Key</strong> to decrypt and open the inside menu.
                        </p>

                        <div>
                          <label
                            htmlFor="home-vault-key-input"
                            className="block text-xs font-medium text-slate-700 mb-1"
                          >
                            Vault Key
                          </label>
                          <div className="relative">
                            <KeyRound
                              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                              aria-hidden="true"
                            />
                            <input
                              id="home-vault-key-input"
                              data-testid="home-vault-key-input"
                              type="password"
                              value={vaultKey}
                              onChange={(e) => {
                                setVaultKey(e.target.value);
                                setVaultError(null);
                              }}
                              placeholder="Enter your vault key"
                              autoFocus
                              className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                            />
                          </div>
                          {vaultError && (
                            <p role="alert" className="mt-1.5 text-xs font-medium text-red-700">
                              {vaultError}
                            </p>
                          )}
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmittingVault}
                          data-testid="home-vault-unlock-btn"
                          className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <KeyRound className="w-4 h-4" aria-hidden="true" />
                          <span>
                            {isSubmittingVault
                              ? 'Decrypting Vault...'
                              : 'Unlock with Vault Key'}
                          </span>
                        </button>
                      </form>
                    )}

                    {accessState.vaultStep === 'unlocked_ready' && (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Your encrypted personal vault is currently unlocked in this browser
                          session.
                        </p>
                        <button
                          type="button"
                          onClick={onContinueToInsideMenu}
                          data-testid="home-vault-continue-btn"
                          className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <span>Open Inside Menu</span>
                          <ArrowRight className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={onLockVault}
                          className="w-full py-2 px-4 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5"
                        >
                          <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Lock Vault &amp; Require Key</span>
                        </button>
                      </div>
                    )}

                    {accessState.vaultStep === 'setup_or_open' && (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Create a private AES-256-GCM vault protected by your own{' '}
                          <strong>Vault Key</strong>, restore an encrypted backup file, or
                          explore a local workspace right away.
                        </p>

                        <button
                          type="button"
                          data-testid="home-create-vault-btn"
                          onClick={() => onOpenCreateVault('create')}
                          className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <PlusCircle className="w-4 h-4" aria-hidden="true" />
                          <span>Create Personal Vault with Key</span>
                        </button>

                        <button
                          type="button"
                          data-testid="home-open-local-workspace-btn"
                          onClick={() => void onOpenLocalWorkspace()}
                          className="w-full py-2.5 px-4 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <span>Open Local Workspace</span>
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    )}

                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => onOpenCreateVault('create')}
                        className="font-medium text-teal-800 hover:text-teal-950 inline-flex items-center gap-1"
                      >
                        <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>New Vault Key</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenCreateVault('import')}
                        className="font-medium text-slate-700 hover:text-slate-900 inline-flex items-center gap-1"
                      >
                        <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Restore Backup (.json)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                <span>AES-256-GCM · Local Web Crypto</span>
                <a
                  href="/privacy.html"
                  className="font-medium text-teal-800 hover:underline"
                >
                  Privacy Policy
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities Asymmetric Bento Grid */}
        <section
          id="capabilities"
          aria-label="SpendVault Core Capabilities"
          className="border-t border-slate-200 bg-white py-14 lg:py-16"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Built for daily Indian personal finance
              </h2>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                Track every rupee across online apps, train tickets, recurring bills, and
                cash expenses without giving up your financial privacy.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <article className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-2.5">
                <h3 className="text-base font-semibold text-slate-900">
                  01. IRCTC Ticket &amp; Online Payment Receipt Reader
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Paste IRCTC booking SMS alerts or Google Pay, PhonePe, Paytm, BHIM, and
                  CRED debit receipts—or optionally connect read-only Gmail scanning.
                  SpendVault extracts merchant, amount, PNR, and train numbers locally while
                  ignoring OTPs, promotional messages, and incoming credits.
                </p>
              </article>

              <article className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-2.5">
                <h3 className="text-base font-semibold text-slate-900">
                  02. Client-Side AES-256-GCM
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Your expenses are encrypted in-browser with PBKDF2-SHA256 before writing to
                  local storage or syncing to Cloud Firestore. Your password or vault key
                  never leaves your device.
                </p>
              </article>

              <article className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-2.5">
                <h3 className="text-base font-semibold text-slate-900">
                  03. Safe Daily Allowance &amp; Recurring Bills
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Know exactly how much you can safely spend per remaining day in the month,
                  and log rent, Wi-Fi, OTT, or commuter passes in one tap.
                </p>
              </article>

              <article className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-2.5">
                <h3 className="text-base font-semibold text-slate-900">
                  04. Complete Per-App &amp; Cash Analytics
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Compare Online (UPI/Card) vs. Cash/COD spend day by day across IRCTC,
                  EatSure, Zomato, Swiggy, Amazon, Flipkart, Blinkit, Zepto, Uber, and manual
                  entries—with group split tracking and instant CSV export.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* How Access Works */}
        <section
          id="how-access-works"
          aria-label="How SpendVault Access Works"
          className="border-t border-slate-200 bg-slate-50 py-14"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Cloud className="w-4 h-4 text-teal-700" aria-hidden="true" />
                  <span>Option A: Gmail Sign-In + Inside Menu Password</span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Log in with any Google account, then enter your personal Inside Menu
                  Password. Your encrypted vault stays synced across Brave, Chrome, and
                  mobile—and nobody can open your inside dashboard without your password.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <KeyRound className="w-4 h-4 text-teal-700" aria-hidden="true" />
                  <span>Option B: Personal Vault Opened by Vault Key</span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Keep everything strictly offline on your device or restore an encrypted
                  <code className="font-mono text-xs mx-1">.json</code> backup. Enter your
                  Vault Key on the Home Menu to decrypt and enter immediately.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Legal Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500">
          <p>
            &copy; 2026 <strong className="font-semibold text-slate-700">SpendVault</strong> ·
            Contact:{' '}
            <a
              href="mailto:prakhargoyal117@gmail.com"
              className="text-slate-700 hover:text-teal-800 hover:underline"
            >
              prakhargoyal117@gmail.com
            </a>
          </p>
          <div className="flex items-center gap-5 shrink-0">
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
  );
}
