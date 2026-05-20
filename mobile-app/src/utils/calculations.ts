import { InventoryItem, DashboardStats } from '../types';

export const EARTH_CIRCUMFERENCE_KM = 40075;
export const TOKYO_OSAKA_KM = 500;

// One-way distances (km) from typical purchase origin to buyer in Japan
const PURCHASE_DISTANCES: Record<string, number> = {
  Amazon: 300,
  'Amazon.co.jp': 300,
  アリエク: 3200,
  AliExpress: 3200,
  セカスト: 15,
  ハードオフ: 15,
  ブックオフ: 15,
  ヤフオク: 200,
  'ヤフオク!': 200,
  メルカリ: 200,
  楽天: 300,
  ヤマダ電機: 20,
  ケーズデンキ: 20,
  ゲオ: 15,
  トレジャーファクトリー: 15,
  その他: 50,
};

const DEFAULT_PURCHASE_DISTANCE = 50;
// Average domestic shipping distance per sale
const SALE_DISTANCE = 300;

export function getPurchaseDistance(source: string): number {
  if (!source) return DEFAULT_PURCHASE_DISTANCE;
  if (PURCHASE_DISTANCES[source] !== undefined) return PURCHASE_DISTANCES[source];
  for (const [key, dist] of Object.entries(PURCHASE_DISTANCES)) {
    if (source.includes(key)) return dist;
  }
  return DEFAULT_PURCHASE_DISTANCE;
}

export function getItemProfit(item: InventoryItem): number {
  if (item.status !== 'sold' || item.soldPrice == null) return 0;
  const commission = item.mercariCommission ?? item.soldPrice * 0.1;
  const shipping = item.shippingFee ?? 0;
  return item.soldPrice - item.purchasePrice - commission - shipping;
}

export function getItemDistance(item: InventoryItem): number {
  return getPurchaseDistance(item.purchaseFrom) + (item.status === 'sold' ? SALE_DISTANCE : 0);
}

export function calcStats(items: InventoryItem[]): DashboardStats {
  const sold = items.filter((i) => i.status === 'sold');
  const totalProfit = sold.reduce((s, i) => s + getItemProfit(i), 0);
  const totalWorkMinutes = sold.reduce((s, i) => s + (i.workMinutes ?? 0), 0);
  const hourlyRate = totalWorkMinutes > 0 ? (totalProfit / totalWorkMinutes) * 60 : 0;
  const totalDistance = items.reduce((s, i) => s + getItemDistance(i), 0);

  return {
    totalItems: items.length,
    inStockCount: items.filter((i) => i.status === 'in-stock').length,
    soldCount: sold.length,
    totalProfit,
    totalWorkMinutes,
    hourlyRate,
    totalDistance,
    earthLaps: totalDistance / EARTH_CIRCUMFERENCE_KM,
  };
}

// Suggest the lowest unoccupied address (A-1, A-2 ... Z-20)
export function suggestNextAddress(items: InventoryItem[]): string {
  const occupied = new Set(
    items.filter((i) => i.status === 'in-stock').map((i) => i.storageAddress)
  );
  for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    for (let num = 1; num <= 20; num++) {
      const addr = `${letter}-${num}`;
      if (!occupied.has(addr)) return addr;
    }
  }
  return 'A-1';
}

export function formatCurrency(amount: number): string {
  return `¥${Math.round(amount).toLocaleString('ja-JP')}`;
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分`;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}
