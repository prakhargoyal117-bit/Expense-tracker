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
    appId: 'irctc',
    category: ExpenseCategory.TRANSPORT,
    displayName: 'IRCTC',
    patterns: [
      /\birctc\b/i,
      /indian\s*railways/i,
      /ticketadmin@irctc/i,
      /\be-?ticket\b.*\bpnr\b/i,
      /\bpnr\s*[:#\-]?\s*\d{10}\b/i,
    ],
  },
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
    appId: 'eatsure',
    category: ExpenseCategory.FOOD,
    displayName: 'EatSure',
    patterns: [/eatsure/i, /eat\s*sure/i, /ovenstory/i],
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
  // Prioritize explicit total or ticket fare labels first, then currency markers
  const priorityPatterns = [
    /(?:grand\s*total|order\s*total|total\s*paid|amount\s*paid|total\s*amount|bill\s*total|ticket\s*fare|total\s*fare|fare|paid)\s*[:\-]?\s*(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
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

export function extractIrctcDetails(text: string): {
  pnr: string | null;
  trainNo: string | null;
} {
  const pnrMatch = /\bpnr\s*(?:no\.?|number)?\s*[:#\-]?\s*(\d{10})\b/i.exec(text);
  const trainMatch =
    /\b(?:trn|train(?:\s*no\.?|\s*number)?)\s*[:#\-]?\s*(\d{5})\b/i.exec(text);
  return {
    pnr: pnrMatch?.[1] ?? null,
    trainNo: trainMatch?.[1] ?? null,
  };
}

export function parseGmailReceiptMessage(msg: GmailRawMessage): ExpenseEntry | null {
  const from = msg.headers.from ?? '';
  const subject = msg.headers.subject ?? '';
  const body = msg.bodyText ?? msg.snippet ?? '';
  const fullText = `${subject}\n${msg.snippet ?? ''}\n${body}`;

  // Filter out promo/marketing emails without order/receipt/ticket keywords
  const looksLikeReceipt =
    /\b(order|receipt|invoice|delivered|trip|booking|booked|ticket|e-?ticket|pnr|fare|confirmed|payment|bill|summary)\b/i.test(
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

  let merchant = cleanSubject
    ? `${matcher.displayName} · ${cleanSubject}`
    : `${matcher.displayName} Order`;

  let notes = 'Imported from Gmail receipt';
  if (matcher.appId === 'irctc') {
    const { pnr, trainNo } = extractIrctcDetails(fullText);
    const metaParts = [
      pnr ? `PNR ${pnr}` : null,
      trainNo ? `Train ${trainNo}` : null,
    ].filter(Boolean);
    if (!cleanSubject) {
      merchant = trainNo ? `IRCTC Train ${trainNo}` : 'IRCTC Rail Ticket';
    }
    notes =
      metaParts.length > 0
        ? `IRCTC e-ticket · ${metaParts.join(' · ')}`
        : 'Imported from IRCTC ticket receipt';
  }

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
    notes,
  };
}

interface PaymentAppMatcher {
  name: string;
  patterns: RegExp[];
}

const ONLINE_PAYMENT_APP_MATCHERS: PaymentAppMatcher[] = [
  {
    name: 'Google Pay',
    patterns: [
      /google\s*pay/i,
      /\bgpay\b/i,
      /@ok(?:icici|axis|sbi|hdfcbank)\b/i,
    ],
  },
  {
    name: 'PhonePe',
    patterns: [/phonepe/i, /@(?:ybl|ibl|axl)\b/i],
  },
  {
    name: 'Paytm',
    patterns: [/paytm/i, /one97/i],
  },
  {
    name: 'BHIM UPI',
    patterns: [/\bbhim\b/i, /@upi\b/i],
  },
  {
    name: 'CRED',
    patterns: [/\bcred(?:\s*pay)?\b/i, /cred\.club/i],
  },
  {
    name: 'Amazon Pay',
    patterns: [/amazon\s*pay/i, /amazonpay/i],
  },
  {
    name: 'Razorpay',
    patterns: [/razorpay/i],
  },
  {
    name: 'Cashfree',
    patterns: [/cashfree/i],
  },
  {
    name: 'MobiKwik',
    patterns: [/mobikwik/i],
  },
  {
    name: 'Freecharge',
    patterns: [/freecharge/i],
  },
  {
    name: 'PayZapp',
    patterns: [/payzapp/i],
  },
  {
    name: 'Jupiter',
    patterns: [/\bjupiter\b/i],
  },
  {
    name: 'Slice',
    patterns: [/\bslice\s*(?:pay|upi|card)?\b/i],
  },
  {
    name: 'Navi UPI',
    patterns: [/\bnavi\s*upi\b/i],
  },
  {
    name: 'UPI Payment App',
    patterns: [
      /\bupi\s*(?:ref|reference|id|txn|transaction|payment)\b/i,
      /\b(?:paid|debited|sent)\s*(?:via|using|through|by)\s*upi\b/i,
      /\bvpa\b/i,
    ],
  },
];

export function detectOnlinePaymentApp(
  from: string,
  subject: string,
  text: string,
): string | null {
  const combined = `${from}\n${subject}\n${text.slice(0, 600)}`;
  for (const matcher of ONLINE_PAYMENT_APP_MATCHERS) {
    if (matcher.patterns.some((re) => re.test(combined))) {
      return matcher.name;
    }
  }
  return null;
}

function inferExpenseCategory(text: string): ExpenseCategory {
  if (
    /\b(chai|tea|coffee|cafe|canteen|mess|biryani|pizza|burger|food|bakery|kitchen|restaurant|dhaba|tiffin|eatsure|zomato|swiggy)\b/i.test(
      text,
    )
  ) {
    return ExpenseCategory.FOOD;
  }
  if (
    /\b(uber|ola|rapido|metro|auto|cab|rickshaw|bus|train|irctc|petrol|fuel|parking|toll)\b/i.test(
      text,
    )
  ) {
    return ExpenseCategory.TRANSPORT;
  }
  if (
    /\b(grocery|groceries|mart|supermarket|kirana|milk|dairy|blinkit|zepto|instamart|bigbasket)\b/i.test(
      text,
    )
  ) {
    return ExpenseCategory.GROCERIES;
  }
  if (
    /\b(xerox|print|book|stationery|tuition|exam|library|campus|college|course|notebook)\b/i.test(
      text,
    )
  ) {
    return ExpenseCategory.ACADEMICS;
  }
  if (
    /\b(movie|cinema|bookmyshow|netflix|spotify|prime|hotstar|ticket|concert|gaming)\b/i.test(
      text,
    )
  ) {
    return ExpenseCategory.ENTERTAINMENT;
  }
  if (/\b(amazon|flipkart|myntra|ajio|nykaa|store|shop|apparel)\b/i.test(text)) {
    return ExpenseCategory.SHOPPING;
  }
  return ExpenseCategory.OTHER;
}

function extractPayeeName(text: string, paymentAppName: string): string {
  const patterns = [
    /(?:paid|sent|transferred|payment(?:\s+successful|\s+confirmed)?(?:\s+of)?)\s+(?:(?:₹|rs\.?|inr)\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?\s+)?to\s+([A-Za-z0-9][A-Za-z0-9 &.'\-\/]{1,42}?)(?=\s+(?:via|using|through|on|for|at|upi|ref|with|from)\b|[.,;\n]|$)/i,
    /(?:merchant|payee|beneficiary)\s*[:\-]\s*([A-Za-z0-9][A-Za-z0-9 &.'\-\/]{1,42}?)(?=\s+(?:via|upi|ref)\b|[.,;\n]|$)/i,
    /\b(?:paid|debited).*?\bto\s+([A-Za-z0-9][A-Za-z0-9 &.'\-\/]{1,42}?)(?=\s+(?:via|using|through|on|for|at|upi|ref|with)\b|[.,;\n]|$)/i,
    /\bat\s+([A-Za-z0-9][A-Za-z0-9 &.'\-\/]{1,42}?)(?=\s+(?:via|using|on|upi|ref)\b|[.,;\n]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const candidate = match?.[1]?.trim();
    if (
      candidate &&
      candidate.length >= 2 &&
      !/^(?:your|the|upi|account|a\/c)$/i.test(candidate)
    ) {
      return candidate;
    }
  }

  return `${paymentAppName} Payment`;
}

function extractUpiRef(text: string): string | null {
  const match =
    /(?:upi\s*(?:ref(?:\s*no\.?)?|id|txn(?:\s*id)?)|transaction\s*(?:id|ref(?:erence)?)|utr)\s*[:#\-]?\s*([A-Za-z0-9]{6,24})/i.exec(
      text,
    );
  return match?.[1] ?? null;
}

export function parseOnlinePaymentReceipt(
  msg: GmailRawMessage & { defaultDate?: string },
): ExpenseEntry | null {
  const from = msg.headers.from ?? '';
  const subject = msg.headers.subject ?? '';
  const body = msg.bodyText ?? msg.snippet ?? '';
  const fullText = `${subject}\n${msg.snippet ?? ''}\n${body}`.trim();

  if (!fullText) return null;

  // Reject OTPs / verification codes
  if (
    /\b(otp|one[\s-]*time\s*password|verification\s*code|login\s*code|do\s*not\s*share\s*(?:this|your)?\s*(?:code|otp))\b/i.test(
      fullText,
    )
  ) {
    return null;
  }

  // Reject promotional / cashback / reward spam
  if (
    /\b(win\s*(?:up\s*to|upto)|scratch\s*card|refer\s*(?:&|and)\s*earn|pre[\s-]*approved|apply\s*now|flat\s*\d+%\s*off|claim\s*(?:your\s*)?(?:reward|cashback)|unlocked\s*a\s*reward)\b/i.test(
      fullText,
    )
  ) {
    return null;
  }

  // Reject incoming credits / money received / refunds (only read outgoing payment receipts)
  if (
    /\b(credited\s*(?:to|in|into|with)|money\s*received|you\s*(?:have\s*)?received|received\s*(?:from|₹|rs\.?|inr)|refund\s*(?:processed|credited|initiated)|cashback\s*credited)\b/i.test(
      fullText,
    )
  ) {
    return null;
  }

  // Must confirm an outgoing payment / receipt / IRCTC ticket booking
  const isIrctcTicket =
    /\b(irctc|indian\s*railways)\b/i.test(fullText) ||
    /\bpnr\s*[:#\-]?\s*\d{10}\b/i.test(fullText);

  const hasPaymentConfirmation =
    /\b(paid|debited|payment\s*(?:of|to|successful|success|confirmed|completed|receipt)|sent\s*(?:to|₹|rs\.?|inr)|upi\s*(?:ref|txn|transaction)|transaction\s*(?:id|ref|successful)|bill\s*paid|order\s*paid|receipt|ticket\s*booked|e-?ticket|fare|booked)\b/i.test(
      fullText,
    );
  if (!hasPaymentConfirmation) return null;

  const paymentAppName = detectOnlinePaymentApp(from, subject, fullText);
  if (!paymentAppName && !isIrctcTicket) return null;

  const amount = extractAmountINR(fullText);
  if (!amount) return null;

  let date: string;
  let time: string;
  if (msg.internalDate || msg.headers.date) {
    const formatted = formatEmailDateTime(msg.internalDate, msg.headers.date);
    date = formatted.date;
    time = formatted.time;
  } else {
    const inlineDateMatch = /\b(\d{4}-\d{2}-\d{2})\b/.exec(fullText);
    date = inlineDateMatch?.[1] ?? msg.defaultDate ?? '2026-11-15';
    time = '18:00';
  }

  if (isIrctcTicket) {
    const { pnr, trainNo } = extractIrctcDetails(fullText);
    const upiRef = extractUpiRef(fullText);
    const metaParts = [
      pnr ? `PNR ${pnr}` : null,
      trainNo ? `Train ${trainNo}` : null,
      paymentAppName ? `via ${paymentAppName}` : null,
      upiRef ? `Ref ${upiRef}` : null,
    ].filter(Boolean);

    const merchantLabel = trainNo
      ? `IRCTC Train ${trainNo}${paymentAppName ? ` (${paymentAppName})` : ''}`
      : `IRCTC Rail Ticket${paymentAppName ? ` (${paymentAppName})` : ''}`;

    return {
      id: msg.id.startsWith('gmail-') || msg.id.startsWith('pay-') ? msg.id : `pay-${msg.id}`,
      merchant: merchantLabel.slice(0, 90),
      amount,
      date,
      time,
      mode: PaymentMode.ONLINE,
      category: ExpenseCategory.TRANSPORT,
      appId: 'irctc',
      source: 'app_sync',
      notes:
        metaParts.length > 0
          ? `IRCTC e-ticket · ${metaParts.join(' · ')}`
          : 'IRCTC e-ticket receipt',
    };
  }

  const effectivePaymentApp = paymentAppName!;
  const payee = extractPayeeName(fullText, effectivePaymentApp);
  const matchedMerchantApp = matchAppFromEmail('', payee, payee);
  const upiRef = extractUpiRef(fullText);

  const merchantLabel = payee.toLowerCase().includes(effectivePaymentApp.toLowerCase())
    ? payee
    : `${payee} (${effectivePaymentApp})`;

  return {
    id: msg.id.startsWith('gmail-') || msg.id.startsWith('pay-') ? msg.id : `pay-${msg.id}`,
    merchant: merchantLabel.slice(0, 90),
    amount,
    date,
    time,
    mode: PaymentMode.ONLINE,
    category: matchedMerchantApp?.category ?? inferExpenseCategory(`${payee} ${fullText}`),
    appId: matchedMerchantApp?.appId ?? 'upi_payment',
    source: 'app_sync',
    notes: upiRef
      ? `${effectivePaymentApp} payment receipt · Ref ${upiRef}`
      : `${effectivePaymentApp} payment receipt`,
  };
}

export interface PaymentReceiptBatchResult {
  receipts: ExpenseEntry[];
  totalScanned: number;
  ignoredCount: number;
}

export function parsePaymentAppReceiptBatch(
  rawText: string,
  defaultDate?: string,
): PaymentReceiptBatchResult {
  const blocks = rawText
    .split(/\n\s*(?:---+|===+)\s*\n|\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  // If user pasted multiple single-line receipts separated by single newlines
  const candidates =
    blocks.length === 1 && blocks[0].includes('\n')
      ? blocks[0]
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean)
      : blocks;

  const receipts: ExpenseEntry[] = [];
  let ignoredCount = 0;

  candidates.forEach((block, idx) => {
    const parsed = parseOnlinePaymentReceipt({
      id: `pay-${Date.now()}-${idx}`,
      headers: {},
      bodyText: block,
      defaultDate,
    });
    if (parsed) {
      receipts.push(parsed);
    } else {
      ignoredCount += 1;
    }
  });

  return {
    receipts,
    totalScanned: candidates.length,
    ignoredCount,
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
