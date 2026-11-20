import type { AppId, ExpenseEntry } from '../types/expense';
import { formatGmailApiError } from '../utils/authHelpers';
import {
  type GmailRawMessage,
  parseGmailReceiptMessage,
  parseOnlinePaymentReceipt,
} from '../utils/gmailParser';

export type GmailScanScope = 'all' | 'orders' | 'payment_apps';

export class GmailAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GmailAuthError';
  }
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
}

interface GmailMessagePart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
}

interface GmailMessageResponse {
  id: string;
  internalDate?: string;
  snippet?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: GmailMessagePart[];
  };
}

function decodeBase64UrlUtf8(data?: string): string {
  if (!data) return '';
  try {
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

function extractPlainTextFromPayload(
  payload?: GmailMessageResponse['payload'],
): string {
  if (!payload) return '';
  if (payload.body?.data) {
    return decodeBase64UrlUtf8(payload.body.data);
  }
  const collectText = (parts?: GmailMessagePart[]): string => {
    if (!parts) return '';
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64UrlUtf8(part.body.data);
      }
      if (part.parts) {
        const nested = collectText(part.parts);
        if (nested) return nested;
      }
    }
    for (const part of parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return decodeBase64UrlUtf8(part.body.data).replace(/<[^>]+>/g, ' ');
      }
    }
    return '';
  };
  return collectText(payload.parts);
}

export interface GmailScanResult {
  scannedCount: number;
  importedEntries: ExpenseEntry[];
}

const ORDER_APPS_QUERY =
  '(from:(irctc OR zomato OR swiggy OR eatsure OR amazon OR bigbasket OR meesho OR blinkit OR flipkart OR zepto OR jiomart OR myntra OR ajio OR nykaa OR uber.com OR olacabs OR rapido OR bookmyshow) OR subject:(IRCTC OR "Electronic Reservation Slip" OR Zomato OR Swiggy OR EatSure OR BigBasket OR Meesho OR Amazon OR Blinkit OR Flipkart OR Zepto OR JioMart OR Myntra OR Ajio OR Nykaa OR "trip with Uber" OR "Ola ride" OR Rapido)) (order OR receipt OR invoice OR delivered OR trip OR ticket OR PNR OR booked) -OTP -"verification code" -"use code" -"promo code" -cancelled -refund';

const PAYMENT_APPS_QUERY =
  '("Google Pay" OR GPay OR PhonePe OR Paytm OR FamPay OR FamX OR "Navi UPI" OR "Navi Pay" OR BHIM OR CRED OR Razorpay OR Cashfree OR "Amazon Pay" OR MobiKwik OR Freecharge OR PayZapp OR UPI) (paid OR debited OR "payment receipt" OR "payment successful" OR "transaction id" OR "UPI Ref") -OTP -"verification code" -"scratch card"';

const APP_SPECIFIC_QUERIES: Partial<Record<AppId, string>> = {
  irctc: '(from:irctc OR subject:irctc OR "Electronic Reservation Slip" OR "Indian Railways") (ticket OR PNR OR booking OR fare OR paid)',
  zomato: '(from:zomato OR subject:zomato) (order OR receipt OR invoice OR delivered OR paid) -off -promo',
  swiggy: '(from:swiggy OR subject:swiggy OR instamart) (order OR receipt OR invoice OR delivered OR paid) -off -promo',
  eatsure: '(from:eatsure OR subject:eatsure OR "eat sure" OR ovenstory) (order OR receipt OR invoice OR delivered OR paid) -off -promo',
  bigbasket: '(from:bigbasket OR subject:bigbasket OR bbnow OR bbdaily) (order OR receipt OR invoice OR delivered OR paid) -off -promo',
  meesho: '(from:meesho OR subject:meesho) (order OR receipt OR invoice OR delivered OR confirmed) -off -promo',
  amazon: '(from:amazon OR subject:amazon) (order OR receipt OR invoice OR delivered OR payment) -promo',
  blinkit: '(from:blinkit OR from:grofers OR subject:blinkit) (order OR receipt OR invoice OR delivered) -off -promo',
  flipkart: '(from:flipkart OR subject:flipkart) (order OR receipt OR invoice OR delivered) -off -promo',
  zepto: '(from:zepto OR subject:zepto) (order OR receipt OR invoice OR delivered) -off -promo',
  jiomart: '(from:jiomart OR subject:jiomart OR "JioMart") (order OR receipt OR invoice OR delivered) -off -promo',
  myntra: '(from:myntra OR subject:myntra) (order OR receipt OR invoice OR delivered) -off -promo',
  ajio: '(from:ajio OR subject:ajio) (order OR receipt OR invoice OR delivered) -off -promo',
  nykaa: '(from:nykaa OR subject:nykaa) (order OR receipt OR invoice OR delivered) -off -promo',
  uber: 'from:uber.com (receipt OR "trip with Uber" OR invoice OR "Total") -offer -off -promo -discount -voucher -cancelled',
  ola: 'from:olacabs.com (invoice OR receipt OR ride OR trip) -offer -off -promo -cancelled',
  rapido: '(from:rapido OR subject:rapido) (invoice OR receipt OR ride OR trip) -offer -off -promo -cancelled',
  bookmyshow: '(from:bookmyshow OR subject:bookmyshow) (ticket OR booking OR receipt OR confirmed)',
  upi_payment: PAYMENT_APPS_QUERY,
};

export async function scanGmailOrderReceipts(
  accessToken: string,
  scope: GmailScanScope = 'all',
  appFilter?: AppId,
): Promise<GmailScanResult> {
  const specificQuery = appFilter ? APP_SPECIFIC_QUERIES[appFilter] : undefined;
  const rawQuery =
    specificQuery ??
    (scope === 'orders'
      ? ORDER_APPS_QUERY
      : scope === 'payment_apps'
        ? PAYMENT_APPS_QUERY
        : `(${ORDER_APPS_QUERY}) OR (${PAYMENT_APPS_QUERY})`);

  const query = encodeURIComponent(rawQuery);

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=25`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!listRes.ok) {
    const errText = await listRes.text();
    const formatted = formatGmailApiError(listRes.status, errText);
    if (
      listRes.status === 401 ||
      (listRes.status === 403 && formatted.includes('permission was not checked'))
    ) {
      throw new GmailAuthError(formatted);
    }
    throw new Error(formatted);
  }

  const listData = (await listRes.json()) as GmailListResponse;
  const messageRefs = listData.messages ?? [];
  if (messageRefs.length === 0) {
    return { scannedCount: 0, importedEntries: [] };
  }

  const importedEntries: ExpenseEntry[] = [];

  for (const ref of messageRefs.slice(0, 20)) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(
        ref.id,
      )}?format=full`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    if (!msgRes.ok) continue;

    const msgData = (await msgRes.json()) as GmailMessageResponse;
    const headersObj: GmailRawMessage['headers'] = {};
    for (const h of msgData.payload?.headers ?? []) {
      const key = h.name.toLowerCase();
      if (key === 'from') headersObj.from = h.value;
      if (key === 'subject') headersObj.subject = h.value;
      if (key === 'date') headersObj.date = h.value;
    }

    const rawMsg: GmailRawMessage = {
      id: msgData.id,
      internalDate: msgData.internalDate,
      snippet: msgData.snippet,
      headers: headersObj,
      bodyText: extractPlainTextFromPayload(msgData.payload),
    };

    const parsed =
      appFilter === 'upi_payment' || scope === 'payment_apps'
        ? parseOnlinePaymentReceipt(rawMsg)
        : scope === 'orders'
          ? parseGmailReceiptMessage(rawMsg)
          : parseGmailReceiptMessage(rawMsg) ?? parseOnlinePaymentReceipt(rawMsg);

    if (parsed && (!appFilter || parsed.appId === appFilter)) {
      importedEntries.push(parsed);
    }
  }

  return {
    scannedCount: messageRefs.length,
    importedEntries,
  };
}
