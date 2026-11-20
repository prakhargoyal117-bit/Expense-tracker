import { useState } from 'react';
import {
  BarChart3,
  ChevronRight,
  LayoutDashboard,
  ListOrdered,
  ShieldCheck,
  UserCircle2,
  X,
} from 'lucide-react';
import { formatINR } from '../utils/analytics';

export type NavSection =
  | 'overview'
  | 'insights'
  | 'transactions'
  | 'security'
  | 'profile';

interface SidebarProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
  displayName: string;
  profileLabel: string;
  avatarColor?: string;
  avatarUrl?: string | null;
  monthlySpend: number;
  monthlyBudget: number;
  connectedCount: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'insights', label: 'App Insights', icon: BarChart3 },
  { id: 'transactions', label: 'Transactions', icon: ListOrdered },
  { id: 'security', label: 'Apps & Sync', icon: ShieldCheck },
  { id: 'profile', label: 'Profile & Bills', icon: UserCircle2 },
];

export function Sidebar({
  activeSection,
  onNavigate,
  displayName,
  profileLabel,
  avatarColor = '#0F766E',
  avatarUrl,
  monthlySpend,
  monthlyBudget,
  connectedCount,
  isOpenMobile,
  onCloseMobile,
}: SidebarProps) {
  const [avatarError, setAvatarError] = useState(false);

  const budgetPct =
    monthlyBudget > 0
      ? Math.min(100, Math.round((monthlySpend / monthlyBudget) * 100))
      : 0;
  const isOverBudget = monthlySpend > monthlyBudget;
  const initials =
    displayName
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'SV';

  const content = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-64 shrink-0">
      {/* Brand Wordmark */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200">
        <a
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('overview');
            onCloseMobile();
          }}
          className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 group"
        >
          <span className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
          </span>
          <span className="text-[17px] font-bold tracking-tight text-slate-900">
            SpendVault
          </span>
        </a>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Primary Navigation */}
      <nav aria-label="Main navigation" className="flex-1 px-3 py-5 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate(item.id);
                onCloseMobile();
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-teal-50 text-teal-900'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-teal-700' : 'text-slate-400'
                }`}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Budget Pace & Interactive Profile Card */}
      <div className="px-4 pb-4 space-y-3.5">
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
            <span className="font-medium text-slate-800">Monthly Budget</span>
            <span
              className={`font-mono tabular-nums font-semibold ${
                isOverBudget ? 'text-red-700' : 'text-slate-900'
              }`}
            >
              {budgetPct}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isOverBudget
                  ? 'bg-red-600'
                  : budgetPct > 85
                    ? 'bg-amber-500'
                    : 'bg-teal-700'
              }`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500">
            <span>{formatINR(monthlySpend)}</span>
            <span>of {formatINR(monthlyBudget)}</span>
          </div>
        </div>

        {/* Clickable Profile Trigger */}
        <button
          type="button"
          data-testid="sidebar-profile-btn"
          onClick={() => {
            onNavigate('profile');
            onCloseMobile();
          }}
          className={`w-full text-left pt-3 border-t border-slate-200 flex items-center justify-between gap-2.5 group rounded-lg px-1.5 py-2 transition-colors ${
            activeSection === 'profile' ? 'bg-teal-50/70' : 'hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {avatarUrl && !avatarError ? (
              <img
                src={avatarUrl}
                alt={displayName}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <span
                className="w-9 h-9 rounded-xl text-white text-xs font-semibold flex items-center justify-center shrink-0"
                style={{ backgroundColor: avatarColor }}
              >
                {initials}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-teal-900">
                {displayName}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {profileLabel || `${connectedCount} apps connected`}
              </p>
            </div>
          </div>
          <ChevronRight
            className="w-4 h-4 text-slate-400 group-hover:text-teal-700 shrink-0"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block lg:sticky lg:top-0 lg:h-screen shrink-0">
        {content}
      </aside>
      {isOpenMobile && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-50 h-full">{content}</div>
        </div>
      )}
    </>
  );
}
