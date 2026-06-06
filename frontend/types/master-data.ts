export interface Warehouse {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Partner {
  id: string;
  code: string;
  name: string;
  type: 'SUPPLIER' | 'CUSTOMER' | 'BOTH';
  taxCode?: string;
  address?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  unit: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Currency {
  id: string;
  code: string;
  name: string;
}

export interface ExchangeRate {
  id: string;
  currencyId: string;
  rate: string;
  effectiveDate: string;
  createdAt: string;
  currency: Currency;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
