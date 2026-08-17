export interface CatalogProductRef {
  id: number;
  erpId: string | null;
  name: string;
}

export interface CatalogProduct extends CatalogProductRef {
  gstRate?: string | number | null;
  unit?: string | null;
}

/**
 * Resolve each extracted item to a catalog product id.
 * Matching is exact and case-insensitive: ERP ID first, then product name as
 * a fallback (bills often carry only the name). Unmatched items return null so
 * the order item still records the bill's own text.
 */
export function matchItemsToCatalog(
  items: Array<{ erpId?: string | null; productName?: string | null }>,
  catalog: CatalogProductRef[]
): Array<number | null> {
  const idByErpId = new Map<string, number>();
  const idByName = new Map<string, number>();
  for (const product of catalog) {
    if (product.erpId) idByErpId.set(product.erpId.trim().toLowerCase(), product.id);
    idByName.set(product.name.trim().toLowerCase(), product.id);
  }

  return items.map((item) => {
    const erpKey = (item.erpId || '').trim().toLowerCase();
    const nameKey = (item.productName || '').trim().toLowerCase();
    return (erpKey && idByErpId.get(erpKey)) || idByName.get(nameKey) || null;
  });
}

export interface SuggestionInput {
  erpId?: string | null;
  productName?: string | null;
  hsnCode?: string | null;
}

/**
 * Rank catalog products as candidate links for an extracted item.
 * Exact ERP ID wins, then exact HSN, then name similarity (exact > containment
 * > shared tokens). Used by the bill review UI to offer manual links for
 * items the automatic matcher could not resolve.
 */
export function suggestCatalogProducts(
  item: SuggestionInput,
  catalog: Array<CatalogProductRef & { hsnCode?: string | null }>,
  limit = 5
): Array<CatalogProductRef & { hsnCode?: string | null }> {
  const erpKey = (item.erpId || '').trim().toLowerCase();
  const nameKey = (item.productName || '').trim().toLowerCase();
  const hsnKey = (item.hsnCode || '').trim().toLowerCase();
  const nameTokens = new Set(nameKey.split(/[^a-z0-9]+/).filter(Boolean));

  const scored: Array<{ product: CatalogProductRef & { hsnCode?: string | null }; score: number }> = [];
  for (const product of catalog) {
    const pErp = (product.erpId || '').trim().toLowerCase();
    const pName = product.name.trim().toLowerCase();
    const pHsn = (product.hsnCode || '').trim().toLowerCase();
    let score = 0;

    if (erpKey && pErp === erpKey) score = 100;
    else if (erpKey && pErp.includes(erpKey)) score = 80;
    else if (erpKey && erpKey.includes(pErp)) score = 75;

    if (score < 100 && hsnKey && pHsn === hsnKey) score = Math.max(score, 70);

    if (score < 90 && nameKey) {
      if (pName === nameKey) score = Math.max(score, 90);
      else if (pName.includes(nameKey) || nameKey.includes(pName)) score = Math.max(score, 60);
      else {
        const pTokens = new Set(pName.split(/[^a-z0-9]+/).filter(Boolean));
        let overlap = 0;
        for (const t of pTokens) if (nameTokens.has(t)) overlap += 1;
        if (overlap > 0) score = Math.max(score, 35 + overlap * 10);
      }
    }

    if (score > 0) scored.push({ product, score });
  }

  scored.sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name));
  return scored.slice(0, limit).map((s) => s.product);
}

export interface StockDeduction {
  productId: number;
  quantity: number;
}

/**
 * Aggregate order-item quantities per matched catalog product so stock can be
 * deducted once per product (multiple items of the same product are summed).
 * Unmatched items are skipped — their stock is not tracked in the catalog.
 */
export function aggregateStockDeductions(
  items: Array<{ productId?: number | null; quantity?: number }>
): StockDeduction[] {
  const byProduct = new Map<number, number>();
  for (const item of items) {
    const productId = item.productId;
    if (productId == null) continue;
    const qty = Math.max(0, Math.round(Number(item.quantity) || 0));
    if (qty === 0) continue;
    byProduct.set(productId, (byProduct.get(productId) || 0) + qty);
  }
  return [...byProduct.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

export interface EnrichmentInput {
  gstRate?: number;
  gstAmount?: number;
  totalAmount?: number;
  taxableAmount?: number;
  unit?: string;
  gstRateExplicit?: boolean;
  unitExplicit?: boolean;
}

export interface EnrichedFields {
  gstRate: number;
  unit: string;
  gstAmount: number;
  totalAmount: number;
  /** True when the GST rate came from the catalog rather than the bill. */
  rateEnriched: boolean;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Fill GST rate and unit from the matched catalog product when the bill did
 * not state them explicitly (parser defaults like 5% / 'PCS'). Amounts are
 * re-derived from the effective rate only when the rate was assumed, so an
 * explicitly stated rate/amount pair from the bill is never overwritten.
 */
export function enrichItemFromCatalog(
  item: EnrichmentInput,
  catalogProduct: CatalogProduct | undefined
): EnrichedFields {
  let gstRate = Number(item.gstRate);
  const catalogRate = catalogProduct?.gstRate != null ? Number(catalogProduct.gstRate) : NaN;
  const rateEnriched = !item.gstRateExplicit && !isNaN(catalogRate) && catalogRate > 0;
  if (rateEnriched) gstRate = catalogRate;
  if (!gstRate || gstRate > 28 || gstRate < 0) gstRate = 5;

  const unit = !item.unitExplicit && catalogProduct?.unit
    ? catalogProduct.unit
    : (item.unit || 'PCS');

  const taxableAmount = Number(item.taxableAmount) || 0;
  const derivedGst = round2(taxableAmount * (gstRate / 100));
  const gstAmount = !item.gstRateExplicit
    ? derivedGst
    : (Number(item.gstAmount) || derivedGst);
  const totalAmount = !item.gstRateExplicit
    ? round2(taxableAmount + gstAmount)
    : (Number(item.totalAmount) || round2(taxableAmount + gstAmount));

  return { gstRate, unit, gstAmount, totalAmount, rateEnriched };
}
