import { useState, type FormEvent } from 'react';
import { KeyRound, Lock, ShieldCheck } from 'lucide-react';
import type { EncryptedVaultEnvelope } from '../types/expense';

interface VaultLockScreenProps {
  envelope: EncryptedVaultEnvelope | null;
  onUnlock: (passphrase: string) => Promise<boolean>;
  onResetDemoVault: () => void;
  onOpenCreateVault: (mode: 'create' | 'import') => void;
}

export function VaultLockScreen({
  envelope,
  onUnlock,
  onResetDemoVault,
  onOpenCreateVault,
}: VaultLockScreenProps) {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!passphrase.trim()) {
      setError('Enter your vault passphrase to decrypt your financial records.');
      return;
    }

    setIsDecrypting(true);
    const ok = await onUnlock(passphrase);
    setIsDecrypting(false);

    if (!ok) {
      setError('Invalid passphrase. AES-256-GCM decryption failed.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800 shrink-0">
            <Lock className="w-5 h-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              CampusLedger Vault Locked
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Encrypted with {envelope?.algorithm ?? 'AES-256-GCM'} ·{' '}
              {envelope?.kdf ?? 'PBKDF2-SHA256'}
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">
          All connected app insights, cash logs, and daily summaries remain encrypted in browser storage. Enter your vault passphrase to derive the decryption key in memory.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="unlock-passphrase"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Vault Passphrase
            </label>
            <div className="relative">
              <KeyRound
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="unlock-passphrase"
                type="password"
                value={passphrase}
                onChange={(e) => {
                  setPassphrase(e.target.value);
                  setError(null);
                }}
                placeholder="Enter vault passphrase"
                autoFocus
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
            {error && (
              <p role="alert" className="mt-1.5 text-xs font-medium text-red-700">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isDecrypting}
            className="w-full py-2.5 px-4 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            <span>{isDecrypting ? 'Decrypting Vault...' : 'Decrypt & Unlock Vault'}</span>
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <button
            type="button"
            onClick={() => onOpenCreateVault('create')}
            className="font-medium text-teal-800 hover:text-teal-950"
          >
            Create Personal Vault
          </button>
          <button
            type="button"
            onClick={() => onOpenCreateVault('import')}
            className="font-medium text-slate-700 hover:text-slate-900"
          >
            Restore Backup (.json)
          </button>
        </div>

        {envelope && !envelope.hasCustomPassphrase && (
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              Using default demo session vault
            </span>
            <button
              type="button"
              onClick={() => void onUnlock('campus-vault-local-session')}
              className="text-xs font-medium text-teal-800 hover:text-teal-950"
            >
              Unlock Demo Vault
            </button>
          </div>
        )}

        {envelope?.hasCustomPassphrase && (
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">Forgot your passphrase?</span>
            <button
              type="button"
              onClick={onResetDemoVault}
              className="text-xs font-medium text-red-700 hover:text-red-800"
            >
              Reset Vault to Demo Data
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
