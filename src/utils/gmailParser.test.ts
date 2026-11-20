import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectPaymentMode,
  extractAmountINR,
  parseGmailReceiptMessage,
  parseOnlinePaymentReceipt,
  parsePaymentAppReceiptBatch,
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

test('parseGmailReceiptMessage parses Zomato, EatSure, Amazon, and rejects promotional emails', () => {
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

  const eatsure = parseGmailReceiptMessage({
    id: 'msg789',
    internalDate: String(new Date('2026-11-14T19:30:00Z').getTime()),
    headers: {
      from: 'EatSure <orders@eatsure.com>',
      subject: 'Your EatSure order #ES-9021 is confirmed',
    },
    snippet: 'Order Total: ₹395.00 paid via UPI',
  });

  assert.ok(eatsure);
  assert.equal(eatsure.appId, 'eatsure');
  assert.equal(eatsure.category, ExpenseCategory.FOOD);
  assert.equal(eatsure.amount, 395);

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

test('parseOnlinePaymentReceipt reads only outgoing online payment app receipts and ignores OTPs, promos, and credits', () => {
  const phonepe = parseOnlinePaymentReceipt({
    id: 'pp1',
    headers: {},
    bodyText: 'PhonePe: Paid ₹240.00 to North Gate Xerox via UPI Ref 43298122',
  });
  assert.ok(phonepe);
  assert.equal(phonepe.appId, 'upi_payment');
  assert.equal(phonepe.amount, 240);
  assert.equal(phonepe.category, ExpenseCategory.ACADEMICS);
  assert.ok(phonepe.merchant.includes('North Gate Xerox'));
  assert.ok(phonepe.notes?.includes('PhonePe'));

  const amazonPay = parseOnlinePaymentReceipt({
    id: 'ap1',
    headers: {},
    bodyText: 'Amazon Pay: Payment successful of ₹180 to Metro Smart Card via UPI Ref 99887766',
  });
  assert.ok(amazonPay);
  assert.equal(amazonPay.appId, 'upi_payment');
  assert.equal(amazonPay.amount, 180);

  const batch = parsePaymentAppReceiptBatch(
    [
      'PhonePe: Paid ₹240.00 to North Gate Xerox via UPI Ref 43298122',
      'You paid ₹150 to Sharma Tea Stall using Google Pay',
      'Your OTP is 482910 for Paytm login. Do not share this code.',
      'Win upto ₹500 cashback on PhonePe scratch card! Claim your reward.',
      '₹500.00 credited to your account from Rahul via Google Pay',
    ].join('\n'),
    '2026-11-15',
  );

  assert.equal(batch.totalScanned, 5);
  assert.equal(batch.receipts.length, 2);
  assert.equal(batch.ignoredCount, 3);
  assert.equal(batch.receipts[0].amount, 240);
  assert.equal(batch.receipts[1].amount, 150);
  assert.equal(batch.receipts[1].category, ExpenseCategory.FOOD);
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

test('parseGmailReceiptMessage and parseOnlinePaymentReceipt detect IRCTC e-tickets and extract PNR/Train details', () => {
  const irctcEmail = parseGmailReceiptMessage({
    id: 'irctc-mail-1',
    internalDate: String(new Date('2026-11-18T08:15:00Z').getTime()),
    headers: {
      from: 'IRCTC Ticket <ticketadmin@irctc.co.in>',
      subject: 'Electronic Reservation Slip - PNR 4215893210',
    },
    snippet: 'Train No: 12952 Mumbai Rajdhani. Ticket Fare: Rs. 2,345.00 booked via UPI.',
  });

  assert.ok(irctcEmail);
  assert.equal(irctcEmail.appId, 'irctc');
  assert.equal(irctcEmail.category, ExpenseCategory.TRANSPORT);
  assert.equal(irctcEmail.amount, 2345);
  assert.equal(irctcEmail.mode, PaymentMode.ONLINE);
  assert.match(irctcEmail.notes ?? '', /PNR 4215893210/);
  assert.match(irctcEmail.notes ?? '', /Train 12952/);

  const irctcSms = parseOnlinePaymentReceipt({
    id: 'irctc-sms-1',
    headers: {},
    bodyText: 'IRCTC: Ticket booked PNR:8451920341 TRN:22436 Vande Bharat Fare:Rs.1845.00',
    defaultDate: '2026-11-18',
  });

  assert.ok(irctcSms);
  assert.equal(irctcSms.appId, 'irctc');
  assert.equal(irctcSms.category, ExpenseCategory.TRANSPORT);
  assert.equal(irctcSms.amount, 1845);
  assert.match(irctcSms.merchant, /IRCTC Train 22436/);
  assert.match(irctcSms.notes ?? '', /PNR 8451920341/);

  const irctcUpi = parseOnlinePaymentReceipt({
    id: 'irctc-upi-1',
    headers: {},
    bodyText: 'PhonePe: Paid ₹1,420.00 to IRCTC eTicketing via UPI Ref 51238901',
    defaultDate: '2026-11-18',
  });
  assert.ok(irctcUpi);
  assert.equal(irctcUpi.appId, 'irctc');
  assert.equal(irctcUpi.amount, 1420);
  assert.equal(irctcUpi.category, ExpenseCategory.TRANSPORT);
});

test('parseGmailReceiptMessage eliminates phantom Uber matches on YouTuber/Kuber/promos/cancellations while parsing real Uber receipts', () => {
  // Common false positives that previously matched bare /uber/i
  const youtuberMail = parseGmailReceiptMessage({
    id: 'fp-youtuber',
    headers: {
      from: 'YouTube <no-reply@youtube.com>',
      subject: 'Your favourite YouTuber just uploaded a membership offer',
    },
    snippet: 'Join channel membership for ₹159.00/month. Total: ₹159.',
  });
  assert.equal(youtuberMail, null);

  const kuberMail = parseGmailReceiptMessage({
    id: 'fp-kuber',
    headers: {
      from: 'Kuber Enterprises <billing@kuberent.in>',
      subject: 'Newsletter & monthly digest',
    },
    snippet: 'Exclusive deals starting at ₹499.00 total.',
  });
  assert.equal(kuberMail, null);

  const uberPromo = parseGmailReceiptMessage({
    id: 'fp-uber-promo',
    headers: {
      from: 'Uber <uber@uber.com>',
      subject: 'Get ₹150 off your next Uber ride this weekend!',
    },
    snippet: 'Apply promo code RIDE150 for ₹150 discount on your next trip.',
  });
  assert.equal(uberPromo, null);

  const uberCancelled = parseGmailReceiptMessage({
    id: 'fp-uber-cancel',
    headers: {
      from: 'Uber Receipts <uber.india@uber.com>',
      subject: 'Your Uber trip was cancelled',
    },
    snippet: 'Trip cancelled. Refund of ₹240.00 processed to your UPI account.',
  });
  assert.equal(uberCancelled, null);

  // Genuine Uber ride receipt must still parse accurately
  const realUber = parseGmailReceiptMessage({
    id: 'real-uber-1',
    internalDate: String(new Date('2026-11-19T12:10:00Z').getTime()),
    headers: {
      from: 'Uber Receipts <uber.india@uber.com>',
      subject: 'Your Thursday afternoon trip with Uber',
    },
    snippet: 'Total: ₹268.00 · Paid via UPI · Trip fare ₹240, taxes ₹28.',
  });
  assert.ok(realUber);
  assert.equal(realUber.appId, 'uber');
  assert.equal(realUber.amount, 268);
  assert.equal(realUber.category, ExpenseCategory.TRANSPORT);
});

test('parseOnlinePaymentReceipt and batch parser support FamPay and Navi UPI', () => {
  const fampay = parseOnlinePaymentReceipt({
    id: 'fp-1',
    headers: {},
    bodyText: 'FamPay: Paid ₹185.00 to BigBasket via UPI Ref 71928341',
    defaultDate: '2026-11-19',
  });
  assert.ok(fampay);
  assert.equal(fampay.appId, 'bigbasket');
  assert.equal(fampay.amount, 185);
  assert.equal(fampay.category, ExpenseCategory.GROCERIES);
  assert.match(fampay.notes ?? '', /FamPay/);

  const naviUpi = parseOnlinePaymentReceipt({
    id: 'navi-1',
    headers: {},
    bodyText: 'Navi UPI: Payment successful of ₹340 to Campus Cafe via @naviaxis Ref 88210455',
    defaultDate: '2026-11-19',
  });
  assert.ok(naviUpi);
  assert.equal(naviUpi.appId, 'upi_payment');
  assert.equal(naviUpi.amount, 340);
  assert.match(naviUpi.notes ?? '', /Navi UPI/);

  const famX = parseOnlinePaymentReceipt({
    id: 'famx-1',
    headers: {},
    bodyText: 'FamX: Debited ₹499.00 paid to Meesho via UPI Ref 99120411',
    defaultDate: '2026-11-19',
  });
  assert.ok(famX);
  assert.equal(famX.appId, 'meesho');
  assert.equal(famX.amount, 499);
  assert.equal(famX.category, ExpenseCategory.SHOPPING);
  assert.match(famX.notes ?? '', /FamPay/);
});

test('parseGmailReceiptMessage supports BigBasket, Meesho, Ajio, Nykaa, JioMart, Ola, and Rapido without Coca-Cola false positives', () => {
  const bigbasket = parseGmailReceiptMessage({
    id: 'bb-1',
    headers: {
      from: 'BigBasket <orders@bigbasket.com>',
      subject: 'Your BigBasket order #BB-4481 is delivered',
    },
    snippet: 'Order Total: ₹865.00 paid via UPI',
  });
  assert.ok(bigbasket);
  assert.equal(bigbasket.appId, 'bigbasket');
  assert.equal(bigbasket.category, ExpenseCategory.GROCERIES);
  assert.equal(bigbasket.amount, 865);

  const meesho = parseGmailReceiptMessage({
    id: 'meesho-1',
    headers: {
      from: 'Meesho <noreply@meesho.com>',
      subject: 'Your Meesho order #MS-9122 is confirmed',
    },
    snippet: 'Total Paid: ₹549.00 via Cash on Delivery',
  });
  assert.ok(meesho);
  assert.equal(meesho.appId, 'meesho');
  assert.equal(meesho.category, ExpenseCategory.SHOPPING);
  assert.equal(meesho.mode, PaymentMode.CASH);
  assert.equal(meesho.amount, 549);

  const ajio = parseGmailReceiptMessage({
    id: 'ajio-1',
    headers: {
      from: 'AJIO <care@ajio.com>',
      subject: 'Order Confirmed - AJIO #AJ-5501',
    },
    snippet: 'Grand Total: ₹1,299.00 paid via UPI',
  });
  assert.ok(ajio);
  assert.equal(ajio.appId, 'ajio');
  assert.equal(ajio.amount, 1299);

  const nykaa = parseGmailReceiptMessage({
    id: 'nykaa-1',
    headers: {
      from: 'Nykaa <orders@nykaa.com>',
      subject: 'Your Nykaa order is confirmed',
    },
    snippet: 'Total Paid: ₹799.00 via UPI',
  });
  assert.ok(nykaa);
  assert.equal(nykaa.appId, 'nykaa');
  assert.equal(nykaa.amount, 799);

  const jiomart = parseGmailReceiptMessage({
    id: 'jm-1',
    headers: {
      from: 'JioMart <orders@jiomart.com>',
      subject: 'Your JioMart grocery invoice',
    },
    snippet: 'Total Paid: ₹612.00 via UPI',
  });
  assert.ok(jiomart);
  assert.equal(jiomart.appId, 'jiomart');
  assert.equal(jiomart.category, ExpenseCategory.GROCERIES);

  const rapido = parseGmailReceiptMessage({
    id: 'rp-1',
    headers: {
      from: 'Rapido <receipts@rapido.bike>',
      subject: 'Your Rapido Bike ride receipt',
    },
    snippet: 'Total Paid: ₹75.00 via UPI',
  });
  assert.ok(rapido);
  assert.equal(rapido.appId, 'rapido');
  assert.equal(rapido.category, ExpenseCategory.TRANSPORT);

  const ola = parseGmailReceiptMessage({
    id: 'ola-1',
    headers: {
      from: 'Ola Cabs <noreply@olacabs.com>',
      subject: 'Your Ola Auto ride receipt',
    },
    snippet: 'Total Paid: ₹145.00 via UPI',
  });
  assert.ok(ola);
  assert.equal(ola.appId, 'ola');
  assert.equal(ola.category, ExpenseCategory.TRANSPORT);

  // Word-boundary check: Coca-Cola must NOT match Ola
  const cola = parseGmailReceiptMessage({
    id: 'fp-cola',
    headers: {
      from: 'Coca-Cola Store <orders@cocacola.com>',
      subject: 'Your Coca-Cola receipt',
    },
    snippet: 'Total Paid: ₹120.00',
  });
  assert.equal(cola, null);
});


