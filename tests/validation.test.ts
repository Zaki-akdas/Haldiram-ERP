import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateGSTIN,
  validatePAN,
  validatePhone,
  validateERPId,
  validateGSTCalculation,
  validateTotalCalculation,
  validateInvoiceNumber,
  numberToWords,
} from '@/lib/validation';

test('validateGSTIN accepts a well-formed 15-character GSTIN', () => {
  const result = validateGSTIN('27AABCU9603R1ZM');
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('validateGSTIN rejects malformed GSTINs', () => {
  assert.equal(validateGSTIN('').valid, false);
  assert.equal(validateGSTIN('27AABCU9603R1Z').valid, false); // 14 chars
  assert.equal(validateGSTIN('27AABCU9603R1ZMM').valid, false); // 16 chars
  assert.equal(validateGSTIN('27AABCU9603R11A').valid, false); // digit where the literal Z belongs
});

test('validatePAN accepts a well-formed PAN', () => {
  const result = validatePAN('ABCDE1234F');
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('validatePAN rejects malformed PANs', () => {
  assert.equal(validatePAN('').valid, false);
  assert.equal(validatePAN('ABC123').valid, false);
  assert.equal(validatePAN('ABCDE12345').valid, false); // digit in check slot
});

test('validatePhone accepts Indian mobile numbers with optional country code', () => {
  assert.equal(validatePhone('9876543210').valid, true);
  assert.equal(validatePhone('+91 98765 43210').valid, true);
  assert.equal(validatePhone('98765-43210').valid, true);
  assert.equal(validatePhone('1234567890').valid, false); // invalid prefix
  assert.equal(validatePhone('').valid, false);
});

test('validateERPId accepts 3-50 alphanumeric/dash/underscore IDs', () => {
  assert.equal(validateERPId('P-001').valid, true);
  assert.equal(validateERPId('SKU_12345').valid, true);
  assert.equal(validateERPId('AB').valid, false); // too short
  assert.equal(validateERPId('has space').valid, false);
});

test('validateGSTCalculation detects correct and incorrect GST math', () => {
  const ok = validateGSTCalculation(100, 18, 18);
  assert.equal(ok.valid, true);
  assert.equal(ok.expected, 18);
  const bad = validateGSTCalculation(100, 18, 12);
  assert.equal(bad.valid, false);
  assert.equal(bad.difference, 6);
});

test('validateTotalCalculation sums item totals against expected total', () => {
  const ok = validateTotalCalculation([{ totalAmount: 100 }, { totalAmount: 50 }], 150);
  assert.equal(ok.valid, true);
  const bad = validateTotalCalculation([{ totalAmount: 100 }, { totalAmount: 50 }], 160);
  assert.equal(bad.valid, false);
  assert.equal(bad.difference, 10);
});

test('validateInvoiceNumber accepts alphanumeric invoice numbers', () => {
  assert.equal(validateInvoiceNumber('INV-1001').valid, true);
  assert.equal(validateInvoiceNumber('ABC/2026/01').valid, true);
  assert.equal(validateInvoiceNumber('').valid, false);
  assert.equal(validateInvoiceNumber('has space 1').valid, false);
});

test('numberToWords renders Indian number words', () => {
  assert.equal(numberToWords(0), 'Rupees Zero Only');
  assert.equal(numberToWords(1234), 'Rupees One Thousand Two Hundred and Thirty Four Only');
  assert.equal(numberToWords(100000), 'Rupees One Lakh Only');
  assert.equal(numberToWords(123456789), 'Rupees Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred and Eighty Nine Only');
});
