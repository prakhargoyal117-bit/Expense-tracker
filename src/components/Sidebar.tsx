import { useState } from 'react';
import {
  BarChart3,
  LayoutDashboard,
  ListOrdered,
  ShieldCheck,
  X,
} from 'lucide-react';
import { formatINR } from '../utils/analytics';

export type NavSection = 'overview' | 'insights' | 'transactions' | 'security';

interface SidebarProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
  studentName: string;
  campusName: string;
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
  { id: 'security', label: 'Apps & Security', icon: ShieldCheck },
];

export function Sidebar({
  activeSection,
  onNavigate,
  studentName,
  campusName,
  monthlySpend,
  monthlyBudget,
  connectedCount,
  isOpenMobile,
  onCloseMobile,
}: SidebarProps) {
  const [avatarError, setAvatarError] = useState(false);

  const budgetPct =
    monthlyBudget > 0 ? Math.min(100, Math.round((monthlySpend / monthlyBudget) * 100)) : 0;
  const isOverBudget = monthlySpend > monthlyBudget;

  const content = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-64 shrink-0">
      {/* Brand Wordmark */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200">
        <a
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('overview');
            onCloseMobile();
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          CampusLedger
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

      {/* Budget Pace & Vault Status Summary */}
      <div className="px-4 pb-4 space-y-4">
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
            <span className="font-medium text-slate-800">Monthly Allowance</span>
            <span
              className={`font-mono tabular-nums font-semibold ${
                isOverBudget ? 'text-red-700' : 'text-slate-900'
              }`}
            >
              {budgetPct}%
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
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
          <div className="mt-2 flex items-center justify-between text-xs font-mono tabular-nums text-slate-500">
            <span>{formatINR(monthlySpend)}</span>
            <span>of {formatINR(monthlyBudget)}</span>
          </div>
        </div>

        {/* Student Profile */}
        <div className="pt-3 border-t border-slate-200 flex items-center gap-3">
          {!avatarError ? (
            <img
              src="/src/assets/images/avatar_student_user_1794763156604.jpg"
              alt={studentName}
              referrerPolicy="no-referrer"
              onError={() => setAvatarError(true)}
              className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
            />
          ) : (
            <span className="w-9 h-9 rounded-full bg-teal-700 text-white text-xs font-semibold flex items-center justify-center shrink-0">
              {studentName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {studentName}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {campusName} · {connectedCount} apps
            </p>
          </div>
        </div>
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
