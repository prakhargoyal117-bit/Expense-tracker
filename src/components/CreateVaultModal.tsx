import { useState, type ChangeEvent, type FormEvent } from 'react';
import { KeyRound, ShieldCheck, Upload, X } from 'lucide-react';
import type { EncryptedVaultEnvelope } from '../types/expense';

export interface NewPersonalVaultInput {
  studentName: string;
  campusName: string;
  monthlyBudget: number;
  passphrase: string;
  startBlank: boolean;
}

interface CreateVaultModalProps {
  isOpen: boolean;
  initialMode?: 'create' | 'import';
  onClose: () => void;
  onCreateVault: (input: NewPersonalVaultInput) => Promise<void>;
  onImportBackup: (
    envelope: EncryptedVaultEnvelope,
    passphrase: string,
  ) => Promise<boolean>;
}

export function CreateVaultModal({
  isOpen,
  initialMode = 'create',
  onClose,
  onCreateVault,
  onImportBackup,
}: CreateVaultModalProps) {
  const [mode, setMode] = useState<'create' | 'import'>(initialMode);

  // Create form state
  const [studentName, setStudentName] = useState('');
  const [campusName, setCampusName] = useState('Personal Expense Vault');
  const [monthlyBudget, setMonthlyBudget] = useState('15000');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [startBlank, setStartBlank] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Import form state
  const [parsedEnvelope, setParsedEnvelope] =
    useState<EncryptedVaultEnvelope | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [importPassphrase, setImportPassphrase] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  if (!isOpen) return null;

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (studentName.trim().length < 2) {
      setCreateError('Enter your name (at least 2 characters).');
      return;
    }
    const budget = Number(monthlyBudget);
    if (!Number.isFinite(budget) || budget < 500) {
      setCreateError('Monthly budget must be at least ₹500.');
      return;
    }
    if (passphrase.trim().length < 6) {
      setCreateError('Vault passphrase must be at least 6 characters.');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setCreateError('Passphrases do not match.');
      return;
    }

    setIsCreating(true);
    try {
      await onCreateVault({
        studentName: studentName.trim(),
        campusName: campusName.trim() || 'Personal Expense Vault',
        monthlyBudget: Math.round(budget),
        passphrase,
        startBlank,
      });
      setStudentName('');
      setPassphrase('');
      setConfirmPassphrase('');
      onClose();
    } catch {
      setCreateError('Could not initialize encrypted vault.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text) as EncryptedVaultEnvelope;
      if (
        !json ||
        json.algorithm !== 'AES-256-GCM' ||
        !json.saltBase64 ||
        !json.ivBase64 ||
        !json.ciphertextBase64
      ) {
        setImportError(
          'Invalid vault backup file. Select a .json file exported from CampusLedger.',
        );
        setParsedEnvelope(null);
        return;
      }
      setParsedEnvelope(json);
      setFileName(file.name);
    } catch {
      setImportError('Could not read JSON backup file.');
      setParsedEnvelope(null);
    }
  };

  const handleImportSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setImportError(null);
    if (!parsedEnvelope) {
      setImportError('Select an encrypted .json vault backup file first.');
      return;
    }
    const passToTry = parsedEnvelope.hasCustomPassphrase
      ? importPassphrase
      : importPassphrase || 'campus-vault-local-session';

    if (!passToTry) {
      setImportError('Enter the passphrase for this encrypted backup.');
      return;
    }

    setIsImporting(true);
    const ok = await onImportBackup(parsedEnvelope, passToTry);
    setIsImporting(false);

    if (!ok) {
      setImportError(
        'Decryption failed. Check that your passphrase matches this backup.',
      );
      return;
    }
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
        aria-labelledby="vault-wizard-title"
        className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2
              id="vault-wizard-title"
              className="text-base font-semibold text-slate-900"
            >
              Personal Encrypted Vault
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Create a fresh AES-256-GCM personal vault or restore from an encrypted backup.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Personal Vault dialog"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Mode Switch */}
        <div className="px-6 pt-4">
          <div
            role="group"
            aria-label="Vault setup mode"
            className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg"
          >
            <button
              type="button"
              onClick={() => setMode('create')}
              aria-pressed={mode === 'create'}
              className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                mode === 'create'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create New Personal Vault
            </button>
            <button
              type="button"
              onClick={() => setMode('import')}
              aria-pressed={mode === 'import'}
              className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                mode === 'import'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Restore Encrypted Backup
            </button>
          </div>
        </div>

        {mode === 'create' ? (
          <form onSubmit={handleCreateSubmit} noValidate className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="vault-owner-name"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Your Name
                </label>
                <input
                  id="vault-owner-name"
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="e.g., Prakhar Goyal"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
              <div>
                <label
                  htmlFor="vault-campus-label"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Profile Label
                </label>
                <input
                  id="vault-campus-label"
                  type="text"
                  value={campusName}
                  onChange={(e) => setCampusName(e.target.value)}
                  placeholder="Personal Expense Vault"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="vault-initial-budget"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Monthly Budget Target (INR)
              </label>
              <input
                id="vault-initial-budget"
                type="number"
                min="500"
                step="500"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="vault-create-passphrase"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Vault Passphrase
                </label>
                <input
                  id="vault-create-passphrase"
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
              <div>
                <label
                  htmlFor="vault-create-confirm"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Confirm Passphrase
                </label>
                <input
                  id="vault-create-confirm"
                  type="password"
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                  placeholder="Re-enter passphrase"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
            </div>

            <label className="flex items-start gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={startBlank}
                onChange={(e) => setStartBlank(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
              />
              <span>
                <strong className="text-slate-900">Start with a clean, blank ledger</strong>
                <span className="block text-slate-500 mt-0.5">
                  Removes pre-loaded demo transactions so you can import your own Gmail receipts, CSVs, and cash logs.
                </span>
              </span>
            </label>

            {createError && (
              <p role="alert" className="text-xs font-medium text-red-700">
                {createError}
              </p>
            )}

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors"
              >
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                <span>{isCreating ? 'Encrypting Vault...' : 'Create Encrypted Vault'}</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleImportSubmit} className="p-6 space-y-4">
            <div>
              <label
                htmlFor="backup-file-input"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Select Encrypted Vault Backup (.json)
              </label>
              <label
                htmlFor="backup-file-input"
                className="flex flex-col items-center justify-center gap-1.5 p-5 border border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100/70 cursor-pointer transition-colors text-center"
              >
                <Upload className="w-5 h-5 text-slate-500" aria-hidden="true" />
                <span className="text-xs font-medium text-slate-800">
                  {fileName ? `Selected: ${fileName}` : 'Choose .json vault backup file'}
                </span>
                <span className="text-[11px] text-slate-500">
                  AES-256-GCM envelope exported from CampusLedger
                </span>
                <input
                  id="backup-file-input"
                  type="file"
                  accept="application/json,.json"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
            </div>

            <div>
              <label
                htmlFor="import-passphrase"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Backup Passphrase
              </label>
              <div className="relative">
                <KeyRound
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="import-passphrase"
                  type="password"
                  value={importPassphrase}
                  onChange={(e) => setImportPassphrase(e.target.value)}
                  placeholder={
                    parsedEnvelope && !parsedEnvelope.hasCustomPassphrase
                      ? 'Leave blank for default demo passphrase'
                      : 'Enter backup passphrase'
                  }
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
            </div>

            {importError && (
              <p role="alert" className="text-xs font-medium text-red-700">
                {importError}
              </p>
            )}

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isImporting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors"
              >
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                <span>{isImporting ? 'Decrypting...' : 'Decrypt & Restore Backup'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
