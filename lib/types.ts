export interface Transaction {
  id: string;
  timestamp: string;
  amount: number;
  currency: string;
  country: string;
  paymentMethod: string;
  status: string;
  customerEmail: string;
  cardLast4: string;
  cardBIN: string;
  productCategory: string;
  ipCountry: string;
  merchantId: string;
  riskScore?: number;
}

export interface Filters {
  countries: string[];
  paymentMethods: string[];
  statuses: string[];
  amountRange: [number, number];
  dateRange: [string, string];
  searchQuery: string;
  highRiskOnly: boolean;
  /** Only rows whose IP country differs from the billing country. */
  ipMismatchOnly: boolean;
  /** Exact customer emails (empty = all). Set by the "repeat chargebacks" pattern. */
  customerEmails: string[];
}

