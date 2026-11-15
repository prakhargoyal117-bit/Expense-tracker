import {
  type AppId,
  ExpenseCategory,
  type ExpenseEntry,
  PaymentMode,
} from '../types/expense';

export interface GmailRawMessage {
  id: string;
  internalDate?: string;
  snippet?: string;
  headers: {
    from?: string;
    subject?: string;
    date?: string;
  };
  bodyText?: string;
}

interface AppMatcher {
  appId: AppId;
  category: ExpenseCategory;
  patterns: RegExp[];
  displayName: string;
}

const APP_MATCHERS: AppMatcher[] = [
  {
    appId: 'zomato',
    category: ExpenseCategory.FOOD,
    displayName: 'Zomato',
    patterns: [/zomato/i],
  },
  {
    appId: 'swiggy',
    category: ExpenseCategory.FOOD,
    displayName: 'Swiggy',
    patterns: [/swiggy/i, /instamart/i],
  },
  {
    appId: 'amazon',
    category: ExpenseCategory.SHOPPING,
    displayName: 'Amazon',
    patterns: [/amazon\.in/i, /amazon\.com/i, /\bamazon\b/i],
  },
  {
    appId: 'blinkit',
    category: ExpenseCategory.GROCERIES,
    displayName: 'Blinkit',
    patterns: [/blinkit/i, /grofers/i],
  },
  {
    appId: 'flipkart',
    category: ExpenseCategory.SHOPPING,
    displayName: 'Flipkart',
    patterns: [/flipkart/i],
  },
  {
    appId: 'zepto',
    category: ExpenseCategory.GROCERIES,
    displayName: 'Zepto',
    patterns: [/zepto/i],
  },
  {
    appId: 'myntra',
    category: ExpenseCategory.SHOPPING,
    displayName: 'Myntra',
    patterns: [/myntra/i],
  },
  {
    appId: 'uber',
    category: ExpenseCategory.TRANSPORT,
    displayName: 'Uber',
    patterns: [/uber/i],
  },
  {
    appId: 'bookmyshow',
    category: ExpenseCategory.ENTERTAINMENT,
    displayName: 'BookMyShow',
    patterns: [/bookmyshow/i],
  },
];

export function matchAppFromEmail(from: string, subject: string, text: string): AppMatcher | null {
  const combined = `${from} ${subject} ${text.slice(0, 300)}`;
  for (const matcher of APP_MATCHERS) {
    if (matcher.patterns.some((re) => re.test(combined))) {
      return matcher;
    }
  }
  return null;
}

export function extractAmountINR(text: string): number | null {
  // Prioritize explicit total labels first, then currency markers
  const priorityPatterns = [
    /(?:grand\s*total|order\s*total|total\s*paid|amount\s*paid|total\s*amount|bill\s*total|paid)\s*[:\-]?\s*(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    /(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi,
  ];

  const firstMatch = priorityPatterns[0].exec(text);
  if (firstMatch && firstMatch[1]) {
    const val = Math.round(Number(firstMatch[1].replace(/,/g, '')));
    if (Number.isFinite(val) && val > 0 && val < 500_000) {
      return val;
    }
  }

  const allMatches = Array.from(text.matchAll(priorityPatterns[1]));
  const candidates = allMatches
    .map((m) => Math.round(Number(m[1].replace(/,/g, ''))))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 500_000);

  if (candidates.length === 0) return null;
  // Often the largest or last total on a receipt is the order total (avoid picking ₹20 delivery fee when ₹349 total exists)
  return Math.max(...candidates);
}

export function detectPaymentMode(text: string): PaymentMode {
  if (
    /\b(?:cash\s*on\s*delivery|pay\s*on\s*delivery|cod|paid\s*(?:by|in)\s*cash|cash\s*payment)\b/i.test(
      text,
    )
  ) {
    return PaymentMode.CASH;
  }
  return PaymentMode.ONLINE;
}

export function formatEmailDateTime(
  internalDate?: string,
  headerDate?: string,
): { date: string; time: string } {
  let d: Date | null = null;
  if (internalDate && /^\d+$/.test(internalDate)) {
    const ms = Number(internalDate);
    if (Number.isFinite(ms)) d = new Date(ms);
  }
  if ((!d || Number.isNaN(d.getTime())) && headerDate) {
    const parsed = new Date(headerDate);
    if (!Number.isNaN(parsed.getTime())) d = parsed;
  }
  if (!d || Number.isNaN(d.getTime())) {
    d = new Date();
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${mins}`,
  };
}

export function parseGmailReceiptMessage(msg: GmailRawMessage): ExpenseEntry | null {
  const from = msg.headers.from ?? '';
  const subject = msg.headers.subject ?? '';
  const body = msg.bodyText ?? msg.snippet ?? '';
  const fullText = `${subject}\n${msg.snippet ?? ''}\n${body}`;

  // Filter out promo/marketing emails without order/receipt keywords
  const looksLikeReceipt =
    /\b(order|receipt|invoice|delivered|trip|booking|confirmed|payment|bill|summary)\b/i.test(
      fullText,
    );
  if (!looksLikeReceipt) return null;

  const matcher = matchAppFromEmail(from, subject, fullText);
  if (!matcher) return null;

  const amount = extractAmountINR(fullText);
  if (!amount) return null;

  const mode = detectPaymentMode(fullText);
  const { date, time } = formatEmailDateTime(msg.internalDate, msg.headers.date);

  const cleanSubject = subject
    .replace(/^(re:|fwd?:)\s*/i, '')
    .trim()
    .slice(0, 70);

  const merchant = cleanSubject
    ? `${matcher.displayName} · ${cleanSubject}`
    : `${matcher.displayName} Order`;

  return {
    id: `gmail-${msg.id}`,
    merchant,
    amount,
    date,
    time,
    mode,
    category: matcher.category,
    appId: matcher.appId,
    source: 'app_sync',
    notes: 'Imported from Gmail receipt',
  };
}

export function parseStatementCsv(csvText: string): ExpenseEntry[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const splitCsvLine = (line: string): string[] => {
    const out: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    out.push(current.trim());
    return out;
  };

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const dateIdx = headers.findIndex((h) => h.includes('date'));
  const descIdx = headers.findIndex(
    (h) =>
      h.includes('merchant') ||
      h.includes('description') ||
      h.includes('item') ||
      h.includes('narration') ||
      h.includes('title'),
  );
  const amtIdx = headers.findIndex(
    (h) => h.includes('amount') || h.includes('debit') || h.includes('total') || h.includes('inr'),
  );
  const modeIdx = headers.findIndex((h) => h.includes('mode') || h.includes('payment'));

  if (descIdx === -1 || amtIdx === -1) return [];

  const entries: ExpenseEntry[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]);
    const merchant = cols[descIdx]?.trim();
    const rawAmt = cols[amtIdx]?.replace(/[₹,\s]/g, '');
    const amount = Math.round(Number(rawAmt));

    if (!merchant || !Number.isFinite(amount) || amount <= 0) continue;

    let date = '2026-11-15';
    if (dateIdx !== -1 && cols[dateIdx]) {
      const rawDate = cols[dateIdx].slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        date = rawDate;
      } else {
        const parsed = new Date(cols[dateIdx]);
        if (!Number.isNaN(parsed.getTime())) {
          date = parsed.toISOString().slice(0, 10);
        }
      }
    }

    const modeStr = modeIdx !== -1 ? (cols[modeIdx] ?? '') : '';
    const mode = /\bcash\b|\bcod\b/i.test(modeStr)
      ? PaymentMode.CASH
      : /\bonline\b|\bupi\b|\bcard\b/i.test(modeStr)
        ? PaymentMode.ONLINE
        : detectPaymentMode(merchant);

    const matched = matchAppFromEmail('', merchant, merchant);

    entries.push({
      id: `csv-${Date.now()}-${i}`,
      merchant: merchant.slice(0, 120),
      amount,
      date,
      time: '12:00',
      mode,
      category: matched?.category ?? ExpenseCategory.OTHER,
      appId: matched?.appId ?? 'manual',
      source: matched ? 'app_sync' : 'manual',
      notes: 'Imported from CSV statement',
    });
  }

  return entries;
}
