import type { AppId } from '../types/expense';

interface AppBrandIconProps {
  appId: AppId;
  size?: 'sm' | 'md' | 'lg';
}

const APP_BADGE_MAP: Record<AppId, { short: string; bg: string; fg: string }> = {
  irctc: { short: 'IR', bg: '#1D4ED8', fg: '#FFFFFF' },
  zomato: { short: 'Z', bg: '#E23744', fg: '#FFFFFF' },
  swiggy: { short: 'S', bg: '#FC8019', fg: '#FFFFFF' },
  eatsure: { short: 'ES', bg: '#EA580C', fg: '#FFFFFF' },
  amazon: { short: 'a', bg: '#0F172A', fg: '#FFFFFF' },
  blinkit: { short: 'B', bg: '#EAB308', fg: '#0F172A' },
  flipkart: { short: 'F', bg: '#2563EB', fg: '#FFFFFF' },
  zepto: { short: 'Zp', bg: '#7C3AED', fg: '#FFFFFF' },
  myntra: { short: 'M', bg: '#DB2777', fg: '#FFFFFF' },
  uber: { short: 'U', bg: '#1E293B', fg: '#FFFFFF' },
  bookmyshow: { short: 'BM', bg: '#DC2626', fg: '#FFFFFF' },
  upi_payment: { short: 'UPI', bg: '#0D9488', fg: '#FFFFFF' },
  manual: { short: '₹', bg: '#475569', fg: '#FFFFFF' },
};

export function AppBrandIcon({ appId, size = 'md' }: AppBrandIconProps) {
  const cfg = APP_BADGE_MAP[appId] ?? APP_BADGE_MAP.manual;
  const sizeClass =
    size === 'sm'
      ? 'w-7 h-7 text-xs rounded-md'
      : size === 'lg'
        ? 'w-11 h-11 text-base rounded-xl'
        : 'w-9 h-9 text-sm rounded-lg';

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center font-semibold shrink-0 select-none ${sizeClass}`}
      style={{ backgroundColor: cfg.bg, color: cfg.fg }}
    >
      {cfg.short}
    </span>
  );
}
