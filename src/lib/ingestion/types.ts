export type IngestFormat = 'csv' | 'tsv' | 'psv' | 'json' | 'text' | 'pdf' | 'excel' | 'unstructured';
export type DeploymentMode = 'cloud' | 'local';
export type AIProvider = 'gemini' | 'azure' | 'bazaarlink' | 'ollama';

export interface IngestItem {
  srNo?: number;
  erpId?: string;
  productName: string;
  hsnCode?: string;
  mrp?: number;
  unit?: string;
  cases?: number;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxableAmount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  /** Catalog product the user linked manually in the review UI. */
  productId?: number | null;
  /** True when the source bill explicitly stated the GST rate (not a parser default). */
  gstRateExplicit?: boolean;
  /** True when the source bill explicitly stated the unit (not a 'PCS' default). */
  unitExplicit?: boolean;
}

export interface IngestHeader {
  invoiceNumber?: string;
  invoiceDate?: string;
  sellerName?: string;
  sellerGSTIN?: string;
  customerName?: string;
  customerGSTIN?: string;
  customerAddress?: string;
  subtotal?: number;
  taxableAmount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  totalGst?: number;
  grandTotal?: number;
}

export interface IngestResult {
  format: IngestFormat;
  header: IngestHeader;
  items: IngestItem[];
  confidence: number;
  warnings: string[];
  provider?: string;
  processingTimeMs: number;
}

export interface IngestRequest {
  text?: string;
  fileName?: string;
  deploymentMode: DeploymentMode;
  preferredProvider?: AIProvider;
  createOrder?: boolean;
  orderData?: {
    customerId?: number;
    customerName?: string;
    customerGSTIN?: string;
    salespersonId?: number;
    status?: string;
    beat?: string;
    notes?: string;
    creditDays?: number;
  };
}

export interface IngestResponse {
  success: boolean;
  result: IngestResult;
  orderId?: number;
  error?: string;
}
