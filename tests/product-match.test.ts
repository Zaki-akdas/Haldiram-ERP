import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchItemsToCatalog, enrichItemFromCatalog, aggregateStockDeductions, suggestCatalogProducts } from '@/lib/product-match';
import { parseCSV } from '@/lib/ingestion/parsers/csv';
import { parseJSON } from '@/lib/ingestion/parsers/json';

const CATALOG = [
  { id: 11, erpId: 'P101', name: 'Chips 90g' },
  { id: 12, erpId: 'P202', name: 'Water 1L' },
];

test('matchItemsToCatalog matches by ERP ID, case-insensitively', () => {
  const ids = matchItemsToCatalog(
    [{ erpId: 'p101', productName: 'Chips 90g' }, { erpId: 'P101', productName: 'Anything' }],
    CATALOG
  );
  assert.deepEqual(ids, [11, 11]);
});

test('matchItemsToCatalog falls back to exact name match when ERP ID is absent', () => {
  const ids = matchItemsToCatalog(
    [{ erpId: undefined, productName: 'water 1l' }, { erpId: '', productName: 'Chips 90g' }],
    CATALOG
  );
  assert.deepEqual(ids, [12, 11]);
});

test('matchItemsToCatalog prefers ERP ID over a same-named different product', () => {
  const catalog = [
    { id: 1, erpId: 'X1', name: 'Cola' },
    { id: 2, erpId: 'X2', name: 'Cola' },
  ];
  const ids = matchItemsToCatalog([{ erpId: 'X2', productName: 'Cola' }], catalog);
  assert.deepEqual(ids, [2]);
});

test('matchItemsToCatalog returns null for unmatched items', () => {
  const ids = matchItemsToCatalog(
    [{ erpId: 'ZZ99', productName: 'Imported Snack' }, { erpId: undefined, productName: 'Unknown Thing' }],
    CATALOG
  );
  assert.deepEqual(ids, [null, null]);
});

test('parseCSV does not read the GST Rate % column as the unit price', () => {
  const csv = [
    'Invoice No: INV-CSV-001',
    'Date: 01/08/2026',
    'SR No,ERP ID,HSN Code,Product Name,MRP,Rate,Unit,Qty,Taxable Amount,GST Rate %,GST Amount,Total Amount',
    '1,P101,210690,Chips 90g,20,15,PCS,3,45,18,8.1,53.1',
  ].join('\n');

  const result = parseCSV(csv, 'bill.csv');

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].unitPrice, 15);
  assert.equal(result.items[0].gstRate, 18);
  assert.equal(result.items[0].gstAmount, 8.1);
  assert.equal(result.items[0].totalAmount, 53.1);
  assert.equal(result.header.invoiceNumber, 'INV-CSV-001');
});

test('parseCSV derives unit price from taxable/qty when no price column exists', () => {
  const csv = [
    'SR No,ERP ID,Product Name,Qty,Taxable Amount,GST Rate %,GST Amount,Total Amount',
    '1,P101,Chips 90g,3,45,18,8.1,53.1',
  ].join('\n');

  const result = parseCSV(csv, 'bill.csv');

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].unitPrice, 15); // 45 / 3
  assert.equal(result.items[0].gstRate, 18);
});

test('parseCSV marks gstRate/unit explicit only when columns exist', () => {
  const withColumns = parseCSV(
    ['SR No,Product Name,Qty,Taxable Amount,GST Rate %,Unit,Total Amount', '1,Chips 90g,3,45,18,PCS,53.1'].join('\n'),
    'bill.csv'
  );
  assert.equal(withColumns.items[0].gstRateExplicit, true);
  assert.equal(withColumns.items[0].unitExplicit, true);

  const withoutColumns = parseCSV(
    ['SR No,Product Name,Qty,Taxable Amount,Total Amount', '1,Chips 90g,3,45,53.1'].join('\n'),
    'bill.csv'
  );
  assert.equal(withoutColumns.items[0].gstRateExplicit, undefined);
  assert.equal(withoutColumns.items[0].unitExplicit, undefined);
  assert.equal(withoutColumns.items[0].gstRate, 5); // assumed
});

test('parseJSON marks gstRate explicit only when the JSON stated it', () => {
  const withRate = parseJSON(JSON.stringify({ items: [{ name: 'Chips', qty: 3, taxableAmount: 45, gstRate: 18, gstAmount: 8.1, total: 53.1 }] }));
  assert.equal(withRate.items[0].gstRateExplicit, true);

  const withoutRate = parseJSON(JSON.stringify({ items: [{ name: 'Chips', qty: 3, taxableAmount: 45, total: 53.1 }] }));
  assert.equal(withoutRate.items[0].gstRateExplicit, undefined);
  assert.equal(withoutRate.items[0].gstRate, 5);
});

test('enrichItemFromCatalog fills assumed rate/unit from the catalog', () => {
  const item = { gstRate: 5, unit: 'PCS', taxableAmount: 45, gstAmount: 2.25, totalAmount: 47.25 }; // assumed defaults
  const catalog = { id: 1, erpId: 'P101', name: 'Chips 90g', gstRate: '18', unit: 'BTL' };

  const enriched = enrichItemFromCatalog(item, catalog);

  assert.equal(enriched.gstRate, 18);
  assert.equal(enriched.unit, 'BTL');
  assert.equal(enriched.gstAmount, 8.1); // 45 * 18%
  assert.equal(enriched.totalAmount, 53.1);
  assert.equal(enriched.rateEnriched, true);
});

test('enrichItemFromCatalog keeps explicitly stated values from the bill', () => {
  const item = {
    gstRate: 12, gstRateExplicit: true, unit: 'CAN', unitExplicit: true,
    taxableAmount: 200, gstAmount: 24, totalAmount: 224,
  };
  const catalog = { id: 2, erpId: 'P202', name: 'Water 1L', gstRate: '5', unit: 'BTL' };

  const enriched = enrichItemFromCatalog(item, catalog);

  assert.equal(enriched.gstRate, 12);
  assert.equal(enriched.unit, 'CAN');
  assert.equal(enriched.gstAmount, 24);
  assert.equal(enriched.totalAmount, 224);
  assert.equal(enriched.rateEnriched, false);
});

test('enrichItemFromCatalog leaves unmatched items untouched', () => {
  const item = { gstRate: 5, unit: 'PCS', taxableAmount: 80, gstAmount: 4, totalAmount: 84 };
  const enriched = enrichItemFromCatalog(item, undefined);

  assert.equal(enriched.gstRate, 5);
  assert.equal(enriched.unit, 'PCS');
  assert.equal(enriched.gstAmount, 4);
  assert.equal(enriched.totalAmount, 84);
});

test('aggregateStockDeductions sums quantities per product and skips unmatched', () => {
  const deductions = aggregateStockDeductions([
    { productId: 1, quantity: 3 },
    { productId: 1, quantity: 2 }, // same product, summed
    { productId: 2, quantity: 10 },
    { productId: null, quantity: 5 }, // unmatched
    { productId: 3, quantity: 0 }, // zero qty
    { productId: undefined, quantity: 4 }, // unmatched
  ]);

  assert.deepEqual(deductions, [
    { productId: 1, quantity: 5 },
    { productId: 2, quantity: 10 },
  ]);
});

test('aggregateStockDeductions returns empty when nothing is matched', () => {
  assert.deepEqual(aggregateStockDeductions([{ productId: null, quantity: 3 }]), []);
  assert.deepEqual(aggregateStockDeductions([]), []);
});

test('suggestCatalogProducts ranks ERP ID, HSN and name matches', () => {
  const catalog = [
    { id: 1, erpId: 'P101', name: 'Chips 90g', hsnCode: '210690' },
    { id: 2, erpId: 'P202', name: 'Water 1L', hsnCode: '2201' },
    { id: 3, erpId: 'X9', name: 'Frozen Chips 500g', hsnCode: '210690' },
    { id: 4, erpId: 'Q7', name: 'Soan Papdi', hsnCode: '1704' },
  ];

  // Exact ERP ID wins over a name substring match on a different product.
  const byErp = suggestCatalogProducts({ erpId: 'p101', productName: 'Chips 90g' }, catalog, 3);
  assert.equal(byErp[0].id, 1);

  // No ERP ID: HSN tie-breaks over weaker name matches, exact name beats substring.
  const byName = suggestCatalogProducts({ productName: 'Chips 90g', hsnCode: '210690' }, catalog, 5);
  assert.equal(byName[0].id, 1);
  assert.equal(byName[1].id, 3); // shares HSN + name token

  // Fuzzy token overlap surfaces plausible candidates.
  const fuzzy = suggestCatalogProducts({ productName: 'Soan' }, catalog, 5);
  assert.equal(fuzzy[0].id, 4);

  // Unrelated item yields no suggestions.
  assert.deepEqual(suggestCatalogProducts({ productName: 'Steel Pipe' }, catalog, 5), []);
});
