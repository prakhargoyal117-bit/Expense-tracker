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
    <div className="min-h-screen bg-[#f2efeb] text-[#1a1a1a] flex flex-col">
      {/* Strict 3-Zone Editorial Top Bar */}
      <header className="sticky top-0 z-30 bg-[#f2efeb]/95 backdrop-blur-xs border-b border-[#1a1a1a]/10">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-10 h-20 flex items-center justify-between gap-8">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-3 whitespace-nowrap shrink-0"
          >
            <SpendVaultLogo size={32} />
            <span className="font-serif italic text-[1.8rem] font-semibold leading-none tracking-[-0.01em] text-[#1a1a1a]">
              SpendVault
            </span>
          </a>

          <nav
            aria-label="Home menu navigation"
            className="hidden md:flex items-center gap-9 font-mono text-[11px] uppercase tracking-[0.12em] text-[#1a1a1a]/60"
          >
            <a
              href="#why-spendvault"
              className="hover:text-[#1a1a1a] transition-colors whitespace-nowrap shrink-0"
            >
              The Problem
            </a>
            <a
              href="#capabilities"
              className="hover:text-[#1a1a1a] transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <a
              href="#developers"
              className="hover:text-[#1a1a1a] transition-colors whitespace-nowrap shrink-0"
            >
              Engineering
            </a>
            <a
              href="/privacy.html"
              className="hover:text-[#1a1a1a] transition-colors whitespace-nowrap shrink-0"
            >
              Privacy
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
              className="px-5 py-2.5 rounded-full bg-[#0f766e] hover:bg-[#115e59] text-white font-mono text-[11px] uppercase tracking-[0.12em] font-medium transition-colors whitespace-nowrap shrink-0"
            >
              {accessState.gmailStep === 'unlocked_ready' ||
              accessState.vaultStep === 'unlocked_ready'
                ? 'Open Inside Menu'
                : 'Unlock'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero & Editorial Auth Panel */}
        <section
          aria-label="SpendVault Home Menu and Access Portal"
          className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-10 pt-12 pb-16 lg:pt-20 lg:pb-24"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left Column: Editorial Headline & Value Proposition */}
            <div className="lg:col-span-7 flex flex-col justify-center space-y-7">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] font-medium text-[#0f766e]">
                The Visibility Gap Solution
              </p>

              <h1
                className="font-serif font-semibold tracking-[-0.025em] text-[#1a1a1a] leading-[1.04]"
                style={{
                  fontSize: 'clamp(2.85rem, 4.9vw, 4.75rem)',
                  textWrap: 'balance',
                }}
              >
                Automated tracking for the Indian shopping ecosystem.
              </h1>

              <p className="text-base sm:text-[1.08rem] text-[#1a1a1a]/65 leading-relaxed max-w-[580px]">
                Private AES-256-GCM encrypted expense tracker for closed-API shopping apps,
                IRCTC train tickets, food apps, UPI receipts (Google Pay, PhonePe, Paytm,
                FamPay, Navi UPI), recurring bills, and cash spends. Syncing the official
                order receipts already in your Gmail.
              </p>

              <p className="font-mono text-[11px] text-[#1a1a1a]/60 tracking-[0.06em]">
                Cross-browser encrypted sync · AES-256-GCM Web Crypto · Zero merchant APIs required
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-3 max-w-[600px]">
                <div className="border-t border-[#1a1a1a]/12 pt-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.1em] font-medium text-[#1a1a1a]">
                    Gmail Login + Inside Password
                  </p>
                  <p className="text-xs text-[#1a1a1a]/65 mt-1.5 leading-relaxed">
                    Sign in with any Google account to sync across Brave, Chrome, and mobile,
                    protected by your personal Inside Menu password.
                  </p>
                </div>
                <div className="border-t border-[#1a1a1a]/12 pt-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.1em] font-medium text-[#1a1a1a]">
                    Direct Vault Key Access
                  </p>
                  <p className="text-xs text-[#1a1a1a]/65 mt-1.5 leading-relaxed">
                    Prefer no cloud account? Create a local encrypted vault and unlock the
                    inside menu directly with your personal Vault Key.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Elevated White Editorial Auth Panel */}
            <div
              id="access-portal"
              data-testid="home-access-portal"
              className="lg:col-span-5 bg-white rounded-[2rem] p-7 sm:p-10 shadow-[0_40px_80px_-20px_rgba(26,26,26,0.08)] border border-[#1a1a1a]/[0.06] flex flex-col justify-between"
            >
              <div className="space-y-6">
                <div>
                  <h2 className="font-serif text-[2rem] font-semibold leading-tight text-[#1a1a1a]">
                    Inside Menu Access
                  </h2>
                  <p className="text-xs text-[#1a1a1a]/60 mt-1">
                    Choose your unlock method to decrypt and enter SpendVault.
                  </p>
                </div>

                {/* Segmented Mode Switcher */}
                <div
                  role="tablist"
                  aria-label="Workspace unlock method"
                  className="grid grid-cols-2 gap-1 p-1 bg-[#f2efeb] rounded-2xl"
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
                    className={`px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] font-medium rounded-xl transition-all whitespace-nowrap ${
                      activeTab === 'gmail'
                        ? 'bg-white text-[#1a1a1a] shadow-[0_4px_12px_rgba(0,0,0,0.05)]'
                        : 'text-[#1a1a1a]/60 hover:text-[#1a1a1a]'
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
                    className={`px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] font-medium rounded-xl transition-all whitespace-nowrap ${
                      activeTab === 'vault'
                        ? 'bg-white text-[#1a1a1a] shadow-[0_4px_12px_rgba(0,0,0,0.05)]'
                        : 'text-[#1a1a1a]/60 hover:text-[#1a1a1a]'
                    }`}
                  >
                    Vault Key
                  </button>
                </div>

                {cloudStatus && (
                  <p
                    role="status"
                    className="text-xs font-medium text-[#1a1a1a]/80 bg-[#f2efeb] border border-[#1a1a1a]/10 rounded-xl px-4 py-3"
                  >
                    {cloudStatus}
                  </p>
                )}

                {isBootstrapping ? (
                  <div className="py-6 space-y-3" aria-live="polite">
                    <div className="h-4 w-40 bg-[#f2efeb] rounded animate-pulse" />
                    <div className="h-12 w-full bg-[#f2efeb] rounded-xl animate-pulse" />
                    <div className="h-12 w-full bg-[#f2efeb] rounded-xl animate-pulse" />
                  </div>
                ) : activeTab === 'gmail' ? (
                  /* ==================== GMAIL / GOOGLE TAB ==================== */
                  <div className="space-y-5">
                    {accessState.gmailStep === 'sign_in' && (
                      <>
                        <p className="text-xs text-[#1a1a1a]/65 leading-relaxed">
                          Step 1: Sign in with your Google / Gmail account. Step 2: Enter or
                          create your personal <strong className="text-[#1a1a1a]">Inside Menu Password</strong> to open
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
                                className="px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-white bg-[#1a1a1a] hover:bg-[#0f766e] disabled:opacity-50 rounded-xl transition-colors"
                              >
                                Try Redirect Sign-In
                              </button>
                            )}
                            {isSigningInGoogle && (
                              <button
                                type="button"
                                onClick={onCancelGoogleSignIn}
                                className="px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[#1a1a1a] bg-[#f2efeb] hover:bg-[#e6e1da] rounded-xl transition-colors"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="text-[11px] text-[#1a1a1a]/55 leading-relaxed">
                          Open to every Google account. Basic sign-in syncs your encrypted
                          vault without requesting Gmail inbox permissions.
                        </p>
                      </>
                    )}

                    {accessState.gmailStep !== 'sign_in' && googleUser && (
                      <div className="flex items-center justify-between gap-3 bg-[#f2efeb] rounded-2xl p-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          {googleUser.photoURL ? (
                            <img
                              src={googleUser.photoURL}
                              alt={googleUser.displayName ?? 'Google user'}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-xl object-cover shrink-0"
                            />
                          ) : (
                            <span className="w-10 h-10 rounded-xl bg-[#0f766e] text-white text-xs font-semibold flex items-center justify-center shrink-0">
                              {(googleUser.email?.[0] ?? 'G').toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#1a1a1a] truncate">
                              {googleUser.displayName ?? 'Google Account'}
                            </p>
                            <p className="text-[11px] text-[#1a1a1a]/60 truncate">
                              {googleUser.email}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void onGoogleSignOut()}
                          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#1a1a1a]/65 hover:text-[#1a1a1a] shrink-0"
                        >
                          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Sign out</span>
                        </button>
                      </div>
                    )}

                    {accessState.gmailStep === 'create_password' && (
                      <form
                        onSubmit={handleGmailCreatePassword}
                        className="space-y-4"
                        data-testid="home-gmail-create-password-form"
                      >
                        <p className="text-xs text-[#1a1a1a]/65 leading-relaxed">
                          Create an <strong className="text-[#1a1a1a]">Inside Menu Password</strong> for this Gmail
                          account to decrypt your dashboard on any browser.
                        </p>

                        <div>
                          <label
                            htmlFor="home-gmail-new-password"
                            className="block font-mono text-[10px] uppercase tracking-[0.12em] text-[#1a1a1a]/60 mb-1.5"
                          >
                            Inside Menu Password
                          </label>
                          <div className="relative">
                            <Lock
                              className="w-4 h-4 text-[#1a1a1a]/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
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
                              className="w-full pl-10 pr-4 py-3.5 text-sm bg-[#fafafa] border border-[#1a1a1a]/12 rounded-2xl text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 focus:border-[#0f766e]"
                            />
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor="home-gmail-confirm-password"
                            className="block font-mono text-[10px] uppercase tracking-[0.12em] text-[#1a1a1a]/60 mb-1.5"
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
                            className="w-full px-4 py-3.5 text-sm bg-[#fafafa] border border-[#1a1a1a]/12 rounded-2xl text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 focus:border-[#0f766e]"
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
                          className="w-full py-3.5 px-4 font-mono text-xs uppercase tracking-[0.1em] font-medium text-white bg-[#1a1a1a] hover:bg-[#0f766e] disabled:opacity-50 rounded-2xl transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <span>
                            {isSubmittingGmail
                              ? 'Encrypting & Opening...'
                              : 'Save Password & Unlock'}
                          </span>
                          <ArrowRight className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </form>
                    )}

                    {accessState.gmailStep === 'enter_password' && (
                      <form
                        onSubmit={handleGmailEnterPassword}
                        className="space-y-4"
                        data-testid="home-gmail-unlock-form"
                      >
                        <div>
                          <label
                            htmlFor="home-gmail-password"
                            className="block font-mono text-[10px] uppercase tracking-[0.12em] text-[#1a1a1a]/60 mb-1.5"
                          >
                            Inside Menu Password
                          </label>
                          <div className="relative">
                            <Lock
                              className="w-4 h-4 text-[#1a1a1a]/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
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
                              placeholder="Passphrase required for decryption"
                              autoFocus
                              className="w-full pl-10 pr-4 py-3.5 text-sm bg-[#fafafa] border border-[#1a1a1a]/12 rounded-2xl text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 focus:border-[#0f766e]"
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
                          className="w-full py-3.5 px-4 font-mono text-xs uppercase tracking-[0.1em] font-medium text-white bg-[#1a1a1a] hover:bg-[#0f766e] disabled:opacity-50 rounded-2xl transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                          <span>
                            {isSubmittingGmail
                              ? 'Verifying Password...'
                              : 'Verify & Unlock Workspace'}
                          </span>
                        </button>
                      </form>
                    )}

                    {accessState.gmailStep === 'unlocked_ready' && (
                      <div className="space-y-3">
                        <p className="text-xs text-[#1a1a1a]/65 leading-relaxed">
                          Your Gmail-synced vault is unlocked for this session. Continue to
                          the inside menu or lock it to require your password again.
                        </p>
                        <button
                          type="button"
                          onClick={onContinueToInsideMenu}
                          data-testid="home-continue-inside-btn"
                          className="w-full py-3.5 px-4 font-mono text-xs uppercase tracking-[0.1em] font-medium text-white bg-[#1a1a1a] hover:bg-[#0f766e] rounded-2xl transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <span>Continue to Inside Menu</span>
                          <ArrowRight className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={onLockVault}
                          className="w-full py-2.5 px-4 font-mono text-[11px] uppercase tracking-[0.08em] text-[#1a1a1a]/80 bg-[#f2efeb] hover:bg-[#e7e2db] rounded-xl transition-colors inline-flex items-center justify-center gap-1.5"
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
                        className="space-y-4"
                        data-testid="home-vault-key-form"
                      >
                        <p className="text-xs text-[#1a1a1a]/65 leading-relaxed">
                          An encrypted personal vault is stored on this device. Enter its{' '}
                          <strong className="text-[#1a1a1a]">Vault Key</strong> to decrypt and open the inside menu.
                        </p>

                        <div>
                          <label
                            htmlFor="home-vault-key-input"
                            className="block font-mono text-[10px] uppercase tracking-[0.12em] text-[#1a1a1a]/60 mb-1.5"
                          >
                            Vault Key
                          </label>
                          <div className="relative">
                            <KeyRound
                              className="w-4 h-4 text-[#1a1a1a]/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
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
                              className="w-full pl-10 pr-4 py-3.5 text-sm bg-[#fafafa] border border-[#1a1a1a]/12 rounded-2xl text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 focus:border-[#0f766e]"
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
                          className="w-full py-3.5 px-4 font-mono text-xs uppercase tracking-[0.1em] font-medium text-white bg-[#1a1a1a] hover:bg-[#0f766e] disabled:opacity-50 rounded-2xl transition-colors inline-flex items-center justify-center gap-2"
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
                        <p className="text-xs text-[#1a1a1a]/65 leading-relaxed">
                          Your encrypted personal vault is currently unlocked in this browser
                          session.
                        </p>
                        <button
                          type="button"
                          onClick={onContinueToInsideMenu}
                          data-testid="home-vault-continue-btn"
                          className="w-full py-3.5 px-4 font-mono text-xs uppercase tracking-[0.1em] font-medium text-white bg-[#1a1a1a] hover:bg-[#0f766e] rounded-2xl transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <span>Open Inside Menu</span>
                          <ArrowRight className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={onLockVault}
                          className="w-full py-2.5 px-4 font-mono text-[11px] uppercase tracking-[0.08em] text-[#1a1a1a]/80 bg-[#f2efeb] hover:bg-[#e7e2db] rounded-xl transition-colors inline-flex items-center justify-center gap-1.5"
                        >
                          <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Lock Vault &amp; Require Key</span>
                        </button>
                      </div>
                    )}

                    {accessState.vaultStep === 'setup_or_open' && (
                      <div className="space-y-3">
                        <p className="text-xs text-[#1a1a1a]/65 leading-relaxed">
                          Create a private AES-256-GCM vault protected by your own{' '}
                          <strong className="text-[#1a1a1a]">Vault Key</strong>, restore an encrypted backup file, or
                          explore a local workspace right away.
                        </p>

                        <button
                          type="button"
                          data-testid="home-create-vault-btn"
                          onClick={() => onOpenCreateVault('create')}
                          className="w-full py-3.5 px-4 font-mono text-xs uppercase tracking-[0.1em] font-medium text-white bg-[#1a1a1a] hover:bg-[#0f766e] rounded-2xl transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <PlusCircle className="w-4 h-4" aria-hidden="true" />
                          <span>Create Personal Vault</span>
                        </button>

                        <button
                          type="button"
                          data-testid="home-open-local-workspace-btn"
                          onClick={() => void onOpenLocalWorkspace()}
                          className="w-full py-3 px-4 font-mono text-[11px] uppercase tracking-[0.08em] font-medium text-[#1a1a1a] bg-[#f2efeb] hover:bg-[#e7e2db] rounded-xl transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <span>Open Local Workspace</span>
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    )}

                    <div className="pt-3.5 border-t border-[#1a1a1a]/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => onOpenCreateVault('create')}
                        className="font-medium text-[#0f766e] hover:text-[#115e59] inline-flex items-center gap-1"
                      >
                        <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>New Vault Key</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenCreateVault('import')}
                        className="font-medium text-[#1a1a1a]/70 hover:text-[#1a1a1a] inline-flex items-center gap-1"
                      >
                        <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Restore Backup (.json)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-7 pt-4 border-t border-[#1a1a1a]/10 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[#1a1a1a]/55">
                <span>AES-256-GCM · Local Web Crypto</span>
                <a
                  href="/privacy.html"
                  className="font-medium text-[#0f766e] hover:underline"
                >
                  Privacy
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities 3-Column Editorial Feature Grid */}
        <section
          id="capabilities"
          aria-label="SpendVault Core Capabilities"
          className="scroll-mt-20 max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-10"
        >
          <div className="border-t border-[#1a1a1a]/10 py-14 grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-12">
            <article className="space-y-3">
              <p className="font-mono text-[11px] font-medium text-[#0f766e]">[01]</p>
              <h3 className="font-serif text-[1.65rem] font-semibold leading-snug text-[#1a1a1a]">
                API-Independent
              </h3>
              <p className="text-sm text-[#1a1a1a]/65 leading-relaxed">
                Because shopping apps like Amazon, Flipkart, Meesho, BigBasket, Zomato, and Swiggy
                don&apos;t offer public APIs, SpendVault parses verified order receipts from Gmail
                directly inside your browser while ignoring OTPs and promos.
              </p>
            </article>

            <article className="space-y-3">
              <p className="font-mono text-[11px] font-medium text-[#0f766e]">[02]</p>
              <h3 className="font-serif text-[1.65rem] font-semibold leading-snug text-[#1a1a1a]">
                Zero Plaintext
              </h3>
              <p className="text-sm text-[#1a1a1a]/65 leading-relaxed">
                Every transaction record is encrypted with client-side Web Crypto (AES-256-GCM &amp;
                PBKDF2-SHA256) before being stored locally or synced to Cloud Firestore. Your
                password or Vault Key never leaves your device.
              </p>
            </article>

            <article className="space-y-3">
              <p className="font-mono text-[11px] font-medium text-[#0f766e]">[03]</p>
              <h3 className="font-serif text-[1.65rem] font-semibold leading-snug text-[#1a1a1a]">
                Unified Dashboard
              </h3>
              <p className="text-sm text-[#1a1a1a]/65 leading-relaxed">
                Track IRCTC train tickets (PNR &amp; train numbers), Uber, Ola, Rapido, Ajio,
                Nykaa, JioMart, and UPI apps like Google Pay, PhonePe, Paytm, FamPay, and Navi UPI
                in a single Safe Daily Allowance ledger.
              </p>
            </article>
          </div>
        </section>

        {/* Main Motive: Solving the Closed-API Expense Tracking Gap */}
        <section
          id="why-spendvault"
          aria-label="Why SpendVault Exists"
          className="scroll-mt-20 border-t border-[#1a1a1a]/10 bg-white/70 py-16 lg:py-20"
        >
          <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-10 space-y-10">
            <div className="max-w-3xl space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] font-medium text-[#0f766e]">
                Main Motive · Closing the Multi-App Visibility Gap
              </p>
              <h2
                className="font-serif text-3xl sm:text-[2.5rem] font-semibold tracking-[-0.02em] text-[#1a1a1a] leading-[1.08]"
                style={{ textWrap: 'balance' }}
              >
                Shopping apps don&apos;t open their APIs—so we turned your Gmail receipts into a unified expense tracker.
              </h2>
              <p className="text-sm sm:text-base text-[#1a1a1a]/65 leading-relaxed">
                Daily spending is scattered across dozens of walled apps—Amazon, Flipkart, Meesho,
                BigBasket, JioMart, Ajio, Nykaa, Zomato, Swiggy, Blinkit, Zepto, Uber, Ola, Rapido,
                and IRCTC. Because none of these apps expose a public API for personal expense
                tracking, SpendVault turns the receipts already in your inbox into a private ledger.
              </p>
            </div>

            {/* Problem vs. Solution Contrast Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              <article className="bg-white border border-[#1a1a1a]/10 rounded-3xl p-7 sm:p-8 flex flex-col justify-between gap-5">
                <div className="space-y-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#1a1a1a]/55">
                    01. The Problem
                  </p>
                  <h3 className="font-serif text-2xl font-semibold text-[#1a1a1a]">
                    Closed ecosystems with zero public APIs
                  </h3>
                  <p className="text-sm text-[#1a1a1a]/65 leading-relaxed">
                    E-commerce, food delivery, grocery, and cab platforms lock your order history
                    inside separate apps without public developer APIs. Bank statements only show
                    cryptic UPI references, while manually typing every purchase breaks down within
                    days.
                  </p>
                </div>
                <p className="pt-4 border-t border-[#1a1a1a]/10 font-mono text-[11px] text-[#1a1a1a]/55">
                  Fragmented order history · Cryptic bank SMS · No unified per-app breakdown
                </p>
              </article>

              <article className="bg-[#1a1a1a] text-[#f2efeb] border border-[#1a1a1a] rounded-3xl p-7 sm:p-8 flex flex-col justify-between gap-5">
                <div className="space-y-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-teal-300">
                    02. The SpendVault Solution
                  </p>
                  <h3 className="font-serif text-2xl font-semibold text-white">
                    Automatic, privacy-first Gmail receipt syncing
                  </h3>
                  <p className="text-sm text-[#f2efeb]/80 leading-relaxed">
                    Every shopping, travel, and payment app already emails you an official order
                    confirmation or invoice. SpendVault connects via read-only Gmail sync to extract
                    only verified receipts directly inside your browser—automatically ignoring OTPs,
                    promotional offers, and cancelled orders—and encrypts your ledger locally with
                    AES-256-GCM.
                  </p>
                </div>
                <p className="pt-4 border-t border-white/15 font-mono text-[11px] text-teal-200/90">
                  Works without merchant APIs · Zero plaintext servers · Full per-app analytics
                </p>
              </article>
            </div>

            {/* Dual Access Explanation Strip */}
            <div
              id="how-access-works"
              className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2"
            >
              <div className="border-t border-[#1a1a1a]/12 pt-5 space-y-2">
                <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] font-medium text-[#1a1a1a]">
                  <Cloud className="w-3.5 h-3.5 text-[#0f766e]" aria-hidden="true" />
                  <span>Option A · Gmail Sign-In + Inside Menu Password</span>
                </div>
                <p className="text-xs sm:text-sm text-[#1a1a1a]/65 leading-relaxed">
                  Log in with any Google account, then enter your personal Inside Menu Password.
                  Your encrypted vault stays synced across Brave, Chrome, and mobile—and nobody
                  can open your inside dashboard without your password.
                </p>
              </div>

              <div className="border-t border-[#1a1a1a]/12 pt-5 space-y-2">
                <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] font-medium text-[#1a1a1a]">
                  <KeyRound className="w-3.5 h-3.5 text-[#0f766e]" aria-hidden="true" />
                  <span>Option B · Personal Vault Opened by Vault Key</span>
                </div>
                <p className="text-xs sm:text-sm text-[#1a1a1a]/65 leading-relaxed">
                  Keep everything strictly offline on your device or restore an encrypted{' '}
                  <code className="font-mono text-xs">.json</code> backup. Enter your Vault Key on
                  the Home Menu to decrypt and enter immediately.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Developers Section */}
        <section
          id="developers"
          aria-label="SpendVault Developers"
          className="scroll-mt-20 border-t border-[#1a1a1a]/10 bg-[#f2efeb] py-16 lg:py-20"
        >
          <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-10 space-y-8">
            <div className="max-w-2xl space-y-2.5">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] font-medium text-[#0f766e]">
                Engineering · Coursework Showcase
              </p>
              <h2 className="font-serif text-3xl sm:text-[2.25rem] font-semibold tracking-[-0.02em] text-[#1a1a1a]">
                Developed By
              </h2>
              <p className="text-sm text-[#1a1a1a]/65 leading-relaxed">
                Designed and engineered to give everyday shoppers and students complete visibility
                over multi-app spending without sacrificing financial privacy.
              </p>
            </div>

            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
              data-testid="developers-grid"
            >
              {/* Developer Box 1 */}
              <article
                data-testid="developer-card-prakhar"
                className="bg-white border border-[#1a1a1a]/10 rounded-3xl p-7 shadow-[0_24px_50px_-24px_rgba(26,26,26,0.08)] flex flex-col justify-between gap-6"
              >
                <div className="flex items-start gap-4">
                  <div
                    aria-hidden="true"
                    className="w-12 h-12 rounded-2xl bg-[#0f766e] text-white font-serif italic font-semibold text-xl flex items-center justify-center shrink-0"
                  >
                    PG
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#1a1a1a]/50">
                        Developer
                      </p>
                      <h3 className="font-serif text-2xl font-semibold text-[#1a1a1a] leading-tight mt-0.5">
                        Prakhar Goyal
                      </h3>
                    </div>

                    <dl className="divide-y divide-[#1a1a1a]/8 border-t border-[#1a1a1a]/8 text-sm">
                      <div className="py-2.5 flex items-center justify-between gap-4">
                        <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#1a1a1a]/55">
                          Name
                        </dt>
                        <dd className="text-sm font-semibold text-[#1a1a1a] text-right">
                          Prakhar Goyal
                        </dd>
                      </div>
                      <div className="py-2.5 flex items-center justify-between gap-4">
                        <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#1a1a1a]/55">
                          Scholar No.
                        </dt>
                        <dd className="text-sm font-mono tabular-nums font-semibold text-[#1a1a1a] text-right">
                          26U010002
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1a1a1a]/10 flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#1a1a1a]/55">
                    Course Code
                  </span>
                  <span className="text-sm font-mono tabular-nums font-semibold text-[#0f766e]">
                    FoCP(1003)
                  </span>
                </div>
              </article>

              {/* Developer Box 2 */}
              <article
                data-testid="developer-card-mridul"
                className="bg-white border border-[#1a1a1a]/10 rounded-3xl p-7 shadow-[0_24px_50px_-24px_rgba(26,26,26,0.08)] flex flex-col justify-between gap-6"
              >
                <div className="flex items-start gap-4">
                  <div
                    aria-hidden="true"
                    className="w-12 h-12 rounded-2xl bg-[#1a1a1a] text-white font-serif italic font-semibold text-xl flex items-center justify-center shrink-0"
                  >
                    MS
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#1a1a1a]/50">
                        Developer
                      </p>
                      <h3 className="font-serif text-2xl font-semibold text-[#1a1a1a] leading-tight mt-0.5">
                        Mridul Sengar
                      </h3>
                    </div>

                    <dl className="divide-y divide-[#1a1a1a]/8 border-t border-[#1a1a1a]/8 text-sm">
                      <div className="py-2.5 flex items-center justify-between gap-4">
                        <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#1a1a1a]/55">
                          Name
                        </dt>
                        <dd className="text-sm font-semibold text-[#1a1a1a] text-right">
                          Mridul Sengar
                        </dd>
                      </div>
                      <div className="py-2.5 flex items-center justify-between gap-4">
                        <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#1a1a1a]/55">
                          Scholar No.
                        </dt>
                        <dd className="text-sm font-mono tabular-nums font-semibold text-[#1a1a1a] text-right">
                          26U010003
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1a1a1a]/10 flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#1a1a1a]/55">
                    Course Code
                  </span>
                  <span className="text-sm font-mono tabular-nums font-semibold text-[#0f766e]">
                    FoCP(1003)
                  </span>
                </div>
              </article>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#1a1a1a]/10 bg-[#f2efeb]">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-10 py-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs text-[#1a1a1a]/60">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <span>
              &copy; 2026 <strong className="font-semibold text-[#1a1a1a]">SpendVault Ecosystem</strong>
            </span>
            <span className="font-mono text-[11px]">
              Team: Prakhar Goyal (26U010002) · Mridul Sengar (26U010003)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-6 shrink-0">
            <a
              href="/privacy.html"
              className="font-semibold text-[#1a1a1a] hover:text-[#0f766e] hover:underline"
            >
              Privacy Policy
            </a>
            <a
              href="/terms.html"
              className="text-[#1a1a1a]/70 hover:text-[#1a1a1a] hover:underline"
            >
              Terms of Service
            </a>
            <span className="font-mono text-[11px] text-[#0f766e] font-medium">
              FoCP(1003) Project
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
