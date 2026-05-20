export type ItemStatus = 'in-stock' | 'sold';

export interface InventoryItem {
  id: string;
  name: string;
  purchasePrice: number;
  purchaseFrom: string;
  storageAddress: string;
  status: ItemStatus;
  soldPrice?: number;
  shippingFee?: number;
  mercariCommission?: number;
  workMinutes?: number;
  soldAt?: string;
  createdAt: string;
}

export interface SellFormData {
  soldPrice: string;
  shippingFee: string;
  workMinutes: string;
}

export interface DashboardStats {
  totalItems: number;
  inStockCount: number;
  soldCount: number;
  totalProfit: number;
  totalWorkMinutes: number;
  hourlyRate: number;
  totalDistance: number;
  earthLaps: number;
}
