import { useEffect, useState, type FormEvent } from 'react';
import { Lock, ShieldCheck, X } from 'lucide-react';
import type { ConnectedApp } from '../types/expense';
import { AppBrandIcon } from './AppBrandIcon';

interface PermissionConsentModalProps {
  app: ConnectedApp | null;
  defaultAccountHandle?: string;
  onClose: () => void;
  onApprove: (app: ConnectedApp, accountHandle: string, grantedScopeIds: string[]) => void;
}

export function PermissionConsentModal({
  app,
  defaultAccountHandle = '',
  onClose,
  onApprove,
}: PermissionConsentModalProps) {
  const [accountHandle, setAccountHandle] = useState(defaultAccountHandle);
  const [checkedScopes, setCheckedScopes] = useState<Record<string, boolean>>({
    read_orders: false,
    payment_mode: false,
    daily_digest: true,
  });
  const [consentError, setConsentError] = useState<string | null>(null);

  useEffect(() => {
    setAccountHandle(defaultAccountHandle);
    setCheckedScopes({
      read_orders: false,
      payment_mode: false,
      daily_digest: true,
    });
    setConsentError(null);
  }, [app?.id, defaultAccountHandle]);

  if (!app) return null;

  const handleToggle = (scopeId: string) => {
    setCheckedScopes((prev) => ({ ...prev, [scopeId]: !prev[scopeId] }));
    setConsentError(null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!accountHandle.trim()) {
      setConsentError('Enter the account email or phone linked to this app.');
      return;
    }

    const missingRequired = app.scopes.some(
      (s) => s.required && !checkedScopes[s.id],
    );
    if (missingRequired) {
      setConsentError(
        `Please review and approve all required ${app.name} data permissions before connecting.`,
      );
      return;
    }

    const grantedIds = app.scopes
      .filter((s) => checkedScopes[s.id])
      .map((s) => s.id);

    onApprove(app, accountHandle.trim(), grantedIds);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-modal-title"
        className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AppBrandIcon appId={app.id} size="md" />
            <div>
              <h2
                id="consent-modal-title"
                className="text-base font-semibold text-slate-900"
              >
                Authorize {app.name} Account Access
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {app.category} · Real receipt-only sync (no demo orders added)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close permission dialog"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label
              htmlFor="app-account-handle"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              {app.name} Account Email or Phone
            </label>
            <input
              id="app-account-handle"
              type="text"
              value={accountHandle}
              onChange={(e) => {
                setAccountHandle(e.target.value);
                setConsentError(null);
              }}
              placeholder="e.g., your.email@gmail.com or phone number"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-800">
              Requested Permissions (Your Consent Required)
            </p>
            {app.scopes.map((scope) => (
              <label
                key={scope.id}
                className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={!!checkedScopes[scope.id]}
                  onChange={() => handleToggle(scope.id)}
                  className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                />
                <div className="text-xs">
                  <p className="font-semibold text-slate-900">
                    {scope.label}{' '}
                    {scope.required && (
                      <span className="text-red-700 font-normal">(Required)</span>
                    )}
                  </p>
                  <p className="text-slate-500 mt-0.5">{scope.description}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="flex items-start gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
            <Lock className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
            <p>
              <strong>Real Receipts Only &amp; E2EE:</strong> Only real {app.name} order receipts found in your connected Gmail (read-only), CSV uploads, or payment receipt reader are added—never sample orders. Everything is encrypted locally with AES-256-GCM.
            </p>
          </div>

          {consentError && (
            <p role="alert" className="text-xs font-medium text-red-700">
              {consentError}
            </p>
          )}

          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Decline
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
            >
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              <span>Approve & Connect {app.name}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
