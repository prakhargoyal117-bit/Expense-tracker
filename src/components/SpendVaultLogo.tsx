import { useId } from 'react';

interface SpendVaultLogoProps {
  size?: number;
  className?: string;
}

/**
 * Original SpendVault geometric emblem:
 * Combines a segmented AES-256 mechanical vault dial with locking lugs,
 * an amber vault key-pin notch, and a clean Rupee ledger monogram.
 */
export function SpendVaultLogo({ size = 32, className = '' }: SpendVaultLogoProps) {
  const uid = useId().replace(/:/g, '');
  const baseId = `sv-base-${uid}`;
  const goldId = `sv-gold-${uid}`;
  const ringId = `sv-ring-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <defs>
        <linearGradient
          id={baseId}
          x1="36"
          y1="24"
          x2="476"
          y2="488"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#0F766E" />
          <stop offset="55%" stopColor="#0B4F4A" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient
          id={goldId}
          x1="312"
          y1="96"
          x2="420"
          y2="204"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <linearGradient
          id={ringId}
          x1="96"
          y1="96"
          x2="416"
          y2="416"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#5EEAD4" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#14B8A6" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      <rect width="512" height="512" rx="116" fill={`url(#${baseId})`} />
      <rect
        x="22"
        y="22"
        width="468"
        height="468"
        rx="96"
        stroke="#FFFFFF"
        strokeOpacity="0.12"
        strokeWidth="6"
      />

      <path
        d="M368 144A160 160 0 1 1 256 96"
        stroke={`url(#${ringId})`}
        strokeWidth="24"
        strokeLinecap="round"
      />

      <rect x="76" y="242" width="38" height="28" rx="14" fill="#5EEAD4" />
      <rect x="242" y="398" width="28" height="38" rx="14" fill="#2DD4BF" />
      <rect x="398" y="242" width="38" height="28" rx="14" fill="#2DD4BF" />

      <circle cx="364" cy="148" r="34" fill={`url(#${goldId})`} />
      <circle cx="364" cy="148" r="13" fill="#0F172A" />

      <circle cx="256" cy="256" r="118" fill="#FFFFFF" fillOpacity="0.08" />

      <path
        d="M202 188H310"
        stroke="#FFFFFF"
        strokeWidth="26"
        strokeLinecap="round"
      />
      <path
        d="M202 232H302"
        stroke="#FFFFFF"
        strokeWidth="24"
        strokeLinecap="round"
      />
      <path
        d="M242 188C272 188 292 206 292 232C292 258 272 276 242 276H206L288 344"
        stroke="#FFFFFF"
        strokeWidth="26"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
