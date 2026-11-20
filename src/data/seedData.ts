import {
  type ConnectedApp,
  ExpenseCategory,
  type VaultData,
} from '../types/expense';

export const DEFAULT_VAULT_PASSPHRASE = 'campus-vault-local-session';

export function getTodayDateStr(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentMonthStr(now: Date = new Date()): string {
  return getTodayDateStr(now).slice(0, 7);
}

export const TODAY_DATE = getTodayDateStr();
export const CURRENT_MONTH = getCurrentMonthStr();

function makeScopes(appName: string, granted: boolean) {
  return [
    {
      id: 'read_orders',
      label: `Read ${appName} order receipts & amounts`,
      description:
        'Imports item totals, timestamps, and order IDs for monthly tracking.',
      required: true,
      granted,
    },
    {
      id: 'payment_mode',
      label: 'Detect Online vs. Cash on Delivery mode',
      description:
        'Categorizes UPI, Card, Wallet, and Cash payments automatically.',
      required: true,
      granted,
    },
    {
      id: 'daily_digest',
      label: 'Include in encrypted daily spend summaries',
      description:
        'Aggregates daily totals locally inside your AES-256-GCM vault.',
      required: false,
      granted,
    },
  ];
}

export const INITIAL_APPS: ConnectedApp[] = [
  {
    id: 'irctc',
    name: 'IRCTC',
    category: ExpenseCategory.TRANSPORT,
    shortDescription:
      'Indian Railways e-tickets, Tatkal bookings, Vande Bharat & Rail Neer.',
    accentHex: '#1D4ED8',
    isConnected: false,
    connectedAt: null,
    lastSyncedAt: null,
    accountHandle: null,
    scopes: makeScopes('IRCTC', false),
  },
  {
    id: 'zomato',
    name: 'Zomato',
    category: ExpenseCategory.FOOD,
    shortDescription: 'Food delivery, dining out bills & late-night orders.',
    accentHex: '#E23744',
    isConnected: false,
    connectedAt: null,
    lastSyncedAt: null,
    accountHandle: null,
    scopes: makeScopes('Zomato', false),
  },
  {
    id: 'swiggy',
    name: 'Swiggy',
    category: ExpenseCategory.FOOD,
    shortDescription: 'Restaurant deliveries, Swiggy Dineout & Instamart orders.',
    accentHex: '#FC8019',
    isConnected: false,
    connectedAt: null,
    lastSyncedAt: null,
    accountHandle: null,
    scopes: makeScopes('Swiggy', false),
  },
  {
    id: 'eatsure',
    name: 'EatSure',
    category: ExpenseCategory.FOOD,
    shortDescription:
      'Faasos, Behrouz Biryani, Oven Story & multi-brand food court orders.',
    accentHex: '#EA580C',
    isConnected: false,
    connectedAt: null,
    lastSyncedAt: null,
    accountHandle: null,
    scopes: makeScopes('EatSure', false),
  },
  {
    id: 'amazon',
    name: 'Amazon',
    category: ExpenseCategory.SHOPPING,
    shortDescription: 'Books, electronics, stationery & Prime deliveries.',
    accentHex: '#0F172A',
    isConnected: false,
    connectedAt: null,
    lastSyncedAt: null,
    accountHandle: null,
    scopes: makeScopes('Amazon', false),
  },
  {
    id: 'uber',
    name: 'Uber',
    category: ExpenseCategory.TRANSPORT,
    shortDescription: 'Auto rides, cabs & airport shuttles.',
    accentHex: '#1E293B',
    isConnected: false,
    connectedAt: null,
    lastSyncedAt: null,
    accountHandle: null,
    scopes: makeScopes('Uber', false),
  },
  {
    id: 'blinkit',
    name: 'Blinkit',
    category: ExpenseCategory.GROCERIES,
    shortDescription: '10-minute groceries, coffee, snacks & toiletries.',
    accentHex: '#CA8A04',
    isConnected: false,
    connectedAt: null,
    lastSyncedAt: null,
    accountHandle: null,
    scopes: makeScopes('Blinkit', false),
  },
  {
    id: 'flipkart',
    name: 'Flipkart',
    category: ExpenseCategory.SHOPPING,
    shortDescription: 'Apparel, gadgets, accessories & COD parcels.',
    accentHex: '#2563EB',
    isConnected: false,
    connectedAt: null,
    lastSyncedAt: null,
    accountHandle: null,
    scopes: makeScopes('Flipkart', false),
  },
  {
    id: 'zepto',
    name: 'Zepto',
    category: ExpenseCategory.GROCERIES,
    shortDescription: 'Beverages, fruits & instant essentials.',
    accentHex: '#7C3AED',
    isConnected: false,
    connectedAt: null,
    lastSyncedAt: null,
    accountHandle: null,
    scopes: makeScopes('Zepto', false),
  },
  {
    id: 'myntra',
    name: 'Myntra',
    category: ExpenseCategory.SHOPPING,
    shortDescription: 'Wardrobe, footwear & apparel orders.',
    accentHex: '#DB2777',
    isConnected: false,
    connectedAt: null,
    lastSyncedAt: null,
    accountHandle: null,
    scopes: makeScopes('Myntra', false),
  },
  {
    id: 'bookmyshow',
    name: 'BookMyShow',
    category: ExpenseCategory.ENTERTAINMENT,
    shortDescription: 'Movie tickets, comedy shows & live events.',
    accentHex: '#DC2626',
    isConnected: false,
    connectedAt: null,
    lastSyncedAt: null,
    accountHandle: null,
    scopes: makeScopes('BookMyShow', false),
  },
  {
    id: 'upi_payment',
    name: 'Online Payment Apps',
    category: ExpenseCategory.OTHER,
    shortDescription:
      'Read-only payment receipts from GPay, PhonePe, Paytm, BHIM, CRED & Razorpay.',
    accentHex: '#0D9488',
    isConnected: false,
    connectedAt: null,
    lastSyncedAt: null,
    accountHandle: null,
    scopes: makeScopes('Online Payment Apps', false),
  },
];

export function mergeMissingApps(existingApps: ConnectedApp[]): ConnectedApp[] {
  const existingIds = new Set(existingApps.map((a) => a.id));
  const additions = INITIAL_APPS.filter((a) => !existingIds.has(a.id)).map(
    (a) => ({
      ...a,
      isConnected: false,
      connectedAt: null,
      lastSyncedAt: null,
      accountHandle: null,
      scopes: a.scopes.map((s) => ({ ...s, granted: false })),
    }),
  );
  return additions.length > 0 ? [...existingApps, ...additions] : existingApps;
}

export function createInitialVaultData(): VaultData {
  return {
    expenses: [],
    apps: INITIAL_APPS.map((a) => ({
      ...a,
      scopes: a.scopes.map((s) => ({ ...s })),
    })),
    monthlyBudget: 15000,
    savingsGoal: 5000,
    studentName: 'Personal Vault',
    campusName: 'Personal Finance',
    avatarColor: '#0F766E',
    recurringExpenses: [],
  };
}
