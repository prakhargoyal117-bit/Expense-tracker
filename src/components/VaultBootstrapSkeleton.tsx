import { ShieldCheck } from 'lucide-react';

interface VaultBootstrapSkeletonProps {
  statusText?: string;
}

export function VaultBootstrapSkeleton({
  statusText = 'Decrypting AES-256-GCM vault...',
}: VaultBootstrapSkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="vault-bootstrap-skeleton"
      className="min-h-screen bg-[#f2efeb] flex relative overflow-hidden"
    >
      {/* Subtle pulsing sidebar skeleton (desktop) */}
      <aside
        aria-hidden="true"
        className="hidden lg:flex flex-col w-64 shrink-0 bg-white border-r border-slate-200 p-5 gap-6 animate-pulse motion-reduce:animate-none"
      >
        <div className="h-6 w-32 bg-slate-200 rounded-md" />
        <div className="space-y-2.5 flex-1">
          <div className="h-9 w-full bg-teal-50/90 rounded-lg" />
          <div className="h-9 w-full bg-slate-100 rounded-lg" />
          <div className="h-9 w-full bg-slate-100 rounded-lg" />
          <div className="h-9 w-full bg-slate-100 rounded-lg" />
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
          <div className="flex justify-between">
            <div className="h-3 w-24 bg-slate-200 rounded" />
            <div className="h-3 w-8 bg-slate-200 rounded" />
          </div>
          <div className="h-2 w-full bg-slate-200 rounded-full" />
          <div className="flex justify-between">
            <div className="h-3 w-14 bg-slate-200 rounded" />
            <div className="h-3 w-16 bg-slate-200 rounded" />
          </div>
        </div>
      </aside>

      {/* Subtle pulsing main dashboard skeleton */}
      <div
        aria-hidden="true"
        className="flex-1 min-w-0 flex flex-col animate-pulse motion-reduce:animate-none"
      >
        <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-4 w-24 bg-slate-200 rounded" />
            <div className="h-7 w-32 bg-slate-100 rounded-lg hidden sm:block" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 bg-slate-100 rounded-lg hidden sm:block" />
            <div className="h-8 w-24 bg-slate-100 rounded-lg hidden sm:block" />
            <div className="h-8 w-28 bg-teal-100/80 rounded-lg" />
          </div>
        </div>

        <div className="p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
              >
                <div className="h-3 w-28 bg-slate-200 rounded" />
                <div className="h-7 w-24 bg-slate-200/90 rounded" />
                <div className="h-3 w-36 bg-slate-100 rounded" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <div className="space-y-2">
                  <div className="h-4 w-44 bg-slate-200 rounded" />
                  <div className="h-3 w-64 bg-slate-100 rounded" />
                </div>
                <div className="h-4 w-28 bg-slate-100 rounded" />
              </div>
              <div className="h-52 w-full bg-slate-100/80 rounded-lg" />
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="h-4 w-32 bg-slate-200 rounded" />
              <div className="grid grid-cols-3 gap-3 py-2">
                <div className="h-10 bg-slate-100 rounded-md" />
                <div className="h-10 bg-slate-100 rounded-md" />
                <div className="h-10 bg-slate-100 rounded-md" />
              </div>
              <div className="space-y-3 pt-2">
                <div className="h-10 w-full bg-slate-100/90 rounded-lg" />
                <div className="h-10 w-full bg-slate-100/90 rounded-lg" />
                <div className="h-10 w-full bg-slate-100/70 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Centered elevated vault decryption status card */}
      <div className="fixed inset-0 flex items-center justify-center p-6 bg-[#f2efeb]/65 backdrop-blur-[2px]">
        <div className="w-full max-w-sm bg-white border border-[#1a1a1a]/10 rounded-3xl p-6 shadow-[0_24px_50px_-20px_rgba(26,26,26,0.1)] space-y-4">
          <div className="flex items-center gap-3.5">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 border border-teal-200 text-teal-700 shrink-0">
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-xl bg-teal-400/20 animate-ping motion-reduce:animate-none"
              />
              <ShieldCheck className="w-5 h-5 relative" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {statusText}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Deriving local PBKDF2-SHA256 key in memory
              </p>
            </div>
          </div>

          <div
            aria-hidden="true"
            className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden"
          >
            <div className="h-full w-2/3 bg-teal-600/80 rounded-full animate-pulse motion-reduce:animate-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
