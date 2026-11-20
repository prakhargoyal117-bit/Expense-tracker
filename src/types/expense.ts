export enum PaymentMode {
  ONLINE = 'online',
  CASH = 'cash',
}

export enum ExpenseCategory {
  FOOD = 'Food & Dining',
  SHOPPING = 'Online Shopping',
  GROCERIES = 'Groceries & Essentials',
  TRANSPORT = 'Transit & Commute',
  ACADEMICS = 'Academics & Books',
  ENTERTAINMENT = 'Entertainment',
  OTHER = 'Other',
}

export type AppId =
  | 'irctc'
  | 'zomato'
  | 'swiggy'
  | 'eatsure'
  | 'amazon'
  | 'blinkit'
  | 'flipkart'
  | 'zepto'
  | 'myntra'
  | 'uber'
  | 'bookmyshow'
  | 'upi_payment'
  | 'manual';

export interface PermissionScope {
  id: string;
  label: string;
  description: string;
  required: boolean;
  granted: boolean;
}

export interface ConnectedApp {
  id: AppId;
  name: string;
  category: ExpenseCategory;
  shortDescription: string;
  accentHex: string;
  isConnected: boolean;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  accountHandle: string | null;
  scopes: PermissionScope[];
}

export interface GroupOrderSplit {
  totalBillAmount: number;
  splitCount: number;
  yourShare: number;
}

export interface ReminderPreferences {
  enabled: boolean;
  nightlyTime: string; // HH:mm (24h format, e.g., '21:30')
  lastNotifiedDate: string | null; // YYYY-MM-DD
}

export interface RecurringExpense {
  id: string;
  merchant: string;
  amount: number;
  category: ExpenseCategory;
  appId: AppId;
  mode: PaymentMode;
  dayOfMonth: number; // 1-28
  lastLoggedMonth?: string | null; // YYYY-MM
  notes?: string;
}

export interface ProfileUpdateInput {
  displayName: string;
  profileLabel: string;
  monthlyBudget: number;
  savingsGoal: number;
  avatarColor: string;
}

export interface ExpenseEntry {
  id: string;
  merchant: string;
  amount: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  mode: PaymentMode;
  category: ExpenseCategory;
  appId: AppId;
  source: 'app_sync' | 'manual';
  notes?: string;
  groupSplit?: GroupOrderSplit;
}

export interface VaultData {
  expenses: ExpenseEntry[];
  apps: ConnectedApp[];
  monthlyBudget: number;
  savingsGoal?: number;
  studentName: string; // Display name (key kept for backward compatibility with existing vaults)
  campusName: string; // Profile label / role (key kept for backward compatibility)
  avatarColor?: string;
  recurringExpenses?: RecurringExpense[];
  reminderSettings?: ReminderPreferences;
}

export interface EncryptedVaultEnvelope {
  version: 1;
  algorithm: 'AES-256-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  saltBase64: string;
  ivBase64: string;
  ciphertextBase64: string;
  updatedAt: string;
  hasCustomPassphrase: boolean;
}

export interface MonthlySummary {
  month: string;
  totalSpend: number;
  onlineSpend: number;
  cashSpend: number;
  onlinePct: number;
  cashPct: number;
  transactionCount: number;
  monthlyBudget: number;
  remainingBudget: number;
  budgetUsedPct: number;
  dailyAverage: number;
  topApp: {
    appId: AppId;
    appName: string;
    totalSpend: number;
    count: number;
  } | null;
}

export interface DailySummaryPoint {
  day: number;
  dateStr: string;
  label: string;
  onlineSpend: number;
  cashSpend: number;
  totalSpend: number;
  count: number;
  topAppName: string | null;
  transactions: ExpenseEntry[];
}

export interface AppSpendInsight {
  appId: AppId;
  appName: string;
  category: ExpenseCategory;
  accentHex: string;
  isConnected: boolean;
  totalSpend: number;
  onlineSpend: number;
  cashSpend: number;
  count: number;
  avgOrder: number;
  sharePct: number;
}

export interface CategorySpendInsight {
  category: ExpenseCategory;
  totalSpend: number;
  onlineSpend: number;
  cashSpend: number;
  count: number;
  sharePct: number;
}

export interface ExpenseFilters {
  month: string; // YYYY-MM or 'all'
  search: string;
  mode: 'all' | PaymentMode;
  appId: 'all' | AppId;
  category: 'all' | ExpenseCategory;
}

export interface ManualExpenseInput {
  merchant: string;
  amount: string;
  date: string;
  time: string;
  mode: PaymentMode;
  category: ExpenseCategory;
  appId: AppId;
  notes?: string;
  groupSplit?: GroupOrderSplit;
}

export interface ValidationErrors {
  merchant?: string;
  amount?: string;
  date?: string;
}
