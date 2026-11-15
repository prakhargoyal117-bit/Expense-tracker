import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectPaymentMode,
  extractAmountINR,
  parseGmailReceiptMessage,
  parseStatementCsv,
} from './gmailParser';
import { ExpenseCategory, PaymentMode } from '../types/expense';

test('extractAmountINR extracts grand total and ignores smaller delivery fees', () => {
  const body = 'Delivery Fee: ₹25.00\nGrand Total: ₹349.00\nPaid via UPI';
  assert.equal(extractAmountINR(body), 349);

  const commaBody = 'Order Total: Rs. 1,299.00 on Amazon.in';
  assert.equal(extractAmountINR(commaBody), 1299);
});

test('detectPaymentMode distinguishes Cash on Delivery vs Online UPI', () => {
  assert.equal(detectPaymentMode('Paid via Cash on Delivery'), PaymentMode.CASH);
  assert.equal(detectPaymentMode('Payment Mode: COD'), PaymentMode.CASH);
  assert.equal(detectPaymentMode('Paid via Google Pay UPI'), PaymentMode.ONLINE);
});

test('parseGmailReceiptMessage parses Zomato, Amazon, and rejects promotional emails', () => {
  const zomato = parseGmailReceiptMessage({
    id: 'msg123',
    internalDate: String(new Date('2026-11-15T14:20:00Z').getTime()),
    headers: {
      from: 'Zomato <noreply@zomato.com>',
      subject: 'Your Zomato order from Behrouz Biryani is delivered',
    },
    snippet: 'Total Paid: ₹415.00 via UPI',
  });

  assert.ok(zomato);
  assert.equal(zomato.id, 'gmail-msg123');
  assert.equal(zomato.appId, 'zomato');
  assert.equal(zomato.category, ExpenseCategory.FOOD);
  assert.equal(zomato.amount, 415);
  assert.equal(zomato.mode, PaymentMode.ONLINE);

  const amazonCod = parseGmailReceiptMessage({
    id: 'msg456',
    internalDate: String(new Date('2026-11-14T10:00:00Z').getTime()),
    headers: {
      from: 'Amazon.in <auto-confirm@amazon.in>',
      subject: 'Your Amazon.in order #402-123 has been delivered',
    },
    snippet: 'Order Total: Rs. 1,499.00. Payment Method: Pay on Delivery (Cash).',
  });

  assert.ok(amazonCod);
  assert.equal(amazonCod.appId, 'amazon');
  assert.equal(amazonCod.amount, 1499);
  assert.equal(amazonCod.mode, PaymentMode.CASH);

  const promo = parseGmailReceiptMessage({
    id: 'promo1',
    headers: {
      from: 'Zomato <promo@zomato.com>',
      subject: '50% OFF on your next weekend meal!',
    },
    snippet: 'Use code HUNGRY today for ₹150 discount.',
  });
  assert.equal(promo, null);
});

test('parseStatementCsv imports rows with app matching and payment mode detection', () => {
  const csv = [
    'Date,Merchant,Mode,Amount',
    '2026-11-14,"Swiggy Instamart Order",Online,420',
    '2026-11-13,"Campus Bookstore",Cash,350',
  ].join('\n');

  const parsed = parseStatementCsv(csv);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].appId, 'swiggy');
  assert.equal(parsed[0].mode, PaymentMode.ONLINE);
  assert.equal(parsed[0].amount, 420);
  assert.equal(parsed[1].appId, 'manual');
  assert.equal(parsed[1].mode, PaymentMode.CASH);
  assert.equal(parsed[1].amount, 350);
});
