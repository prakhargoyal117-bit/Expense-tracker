import type { ExpenseEntry } from '../types/expense';
import {
  type GmailRawMessage,
  parseGmailReceiptMessage,
} from '../utils/gmailParser';

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

export async function scanGmailOrderReceipts(
  accessToken: string,
): Promise<GmailScanResult> {
  const query = encodeURIComponent(
    '(from:(zomato OR swiggy OR amazon OR blinkit OR flipkart OR zepto OR myntra OR uber OR bookmyshow) OR subject:(Zomato OR Swiggy OR Amazon OR Blinkit OR Flipkart OR Zepto OR Uber)) (order OR receipt OR invoice OR delivered OR trip OR ticket)',
  );

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
    throw new Error(
      `Gmail API error (${listRes.status}): ${errText.slice(0, 180)}`,
    );
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

    const parsed = parseGmailReceiptMessage({
      id: msgData.id,
      internalDate: msgData.internalDate,
      snippet: msgData.snippet,
      headers: headersObj,
      bodyText: extractPlainTextFromPayload(msgData.payload),
    });

    if (parsed) {
      importedEntries.push(parsed);
    }
  }

  return {
    scannedCount: messageRefs.length,
    importedEntries,
  };
}
