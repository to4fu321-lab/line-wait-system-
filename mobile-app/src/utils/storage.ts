import AsyncStorage from '@react-native-async-storage/async-storage';
import { InventoryItem } from '../types';

const STORAGE_KEY = '@resell_inventory_v1';

export async function loadItems(): Promise<InventoryItem[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    return json ? (JSON.parse(json) as InventoryItem[]) : [];
  } catch {
    return [];
  }
}

export async function saveItems(items: InventoryItem[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function addItem(item: InventoryItem): Promise<void> {
  const items = await loadItems();
  await saveItems([...items, item]);
}

export async function updateItem(updated: InventoryItem): Promise<void> {
  const items = await loadItems();
  await saveItems(items.map((i) => (i.id === updated.id ? updated : i)));
}
