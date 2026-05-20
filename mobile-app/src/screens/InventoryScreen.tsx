import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadItems, updateItem } from '../utils/storage';
import { getItemProfit, formatCurrency } from '../utils/calculations';
import { InventoryItem, SellFormData } from '../types';

type TabType = 'in-stock' | 'sold';
type SortKey = 'address' | 'name' | 'date' | 'profit';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'address', label: 'アドレス順' },
  { key: 'name', label: '名前順' },
  { key: 'date', label: '新着順' },
  { key: 'profit', label: '利益順' },
];

export default function InventoryScreen() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [tab, setTab] = useState<TabType>('in-stock');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('address');
  const [sellTarget, setSellTarget] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<SellFormData>({ soldPrice: '', shippingFee: '', workMinutes: '' });
  const [selling, setSelling] = useState(false);

  const loadData = useCallback(async () => {
    setItems(await loadItems());
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const inStockCount = useMemo(() => items.filter((i) => i.status === 'in-stock').length, [items]);
  const soldCount = useMemo(() => items.filter((i) => i.status === 'sold').length, [items]);

  const filtered = useMemo(() => {
    let list = items.filter((i) => i.status === tab);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.storageAddress.toLowerCase().includes(q) ||
          i.purchaseFrom.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      switch (sort) {
        case 'address':
          return a.storageAddress.localeCompare(b.storageAddress);
        case 'name':
          return a.name.localeCompare(b.name, 'ja');
        case 'date':
          return b.createdAt.localeCompare(a.createdAt);
        case 'profit':
          return getItemProfit(b) - getItemProfit(a);
      }
    });

    return list;
  }, [items, tab, search, sort]);

  const openSell = (item: InventoryItem) => {
    setSellTarget(item);
    setForm({ soldPrice: '', shippingFee: '', workMinutes: '' });
  };

  const closeSell = () => setSellTarget(null);

  const handleSell = async () => {
    if (!sellTarget) return;
    const soldPrice = Number(form.soldPrice);
    if (!form.soldPrice || isNaN(soldPrice) || soldPrice <= 0) {
      Alert.alert('エラー', '売却額を入力してください');
      return;
    }

    setSelling(true);
    try {
      const updated: InventoryItem = {
        ...sellTarget,
        status: 'sold',
        soldPrice,
        shippingFee: Number(form.shippingFee) || 0,
        mercariCommission: Math.floor(soldPrice * 0.1),
        workMinutes: Number(form.workMinutes) || 0,
        soldAt: new Date().toISOString(),
      };
      const profit = getItemProfit(updated);
      await updateItem(updated);
      await loadData();
      closeSell();
      Alert.alert(
        '売却完了 🎉',
        `「${updated.name}」\n利益: ${formatCurrency(profit)}\nアドレス ${updated.storageAddress} が空きました`
      );
    } finally {
      setSelling(false);
    }
  };

  // Live fee preview
  const soldPriceNum = Number(form.soldPrice) || 0;
  const mercariCommission = Math.floor(soldPriceNum * 0.1);
  const shippingNum = Number(form.shippingFee) || 0;
  const previewProfit = sellTarget
    ? soldPriceNum - sellTarget.purchasePrice - mercariCommission - shippingNum
    : null;

  const renderItem = ({ item }: { item: InventoryItem }) => {
    const profit = getItemProfit(item);
    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => tab === 'in-stock' && openSell(item)}
        activeOpacity={tab === 'in-stock' ? 0.7 : 1}
      >
        <View style={[styles.addressBadge, tab === 'sold' && styles.addressBadgeSold]}>
          <Text style={[styles.addressText, tab === 'sold' && styles.addressTextSold]}>
            {item.storageAddress}
          </Text>
        </View>

        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.itemMeta}>
            {item.purchaseFrom}　仕入 {formatCurrency(item.purchasePrice)}
          </Text>
          {tab === 'sold' && item.soldPrice != null && (
            <Text style={[styles.profitTag, { color: profit >= 0 ? '#00C853' : '#FF3B30' }]}>
              利益 {formatCurrency(profit)}　売却 {formatCurrency(item.soldPrice)}
            </Text>
          )}
        </View>

        {tab === 'in-stock' && (
          <TouchableOpacity
            style={styles.sellBtn}
            onPress={() => openSell(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.sellBtnText}>売却</Text>
          </TouchableOpacity>
        )}
        {tab === 'sold' && (
          <View style={styles.soldBadge}>
            <Text style={styles.soldBadgeText}>完了</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === 'in-stock' && styles.tabActive]}
          onPress={() => setTab('in-stock')}
        >
          <Text style={[styles.tabText, tab === 'in-stock' && styles.tabTextActive]}>
            在庫中 ({inStockCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'sold' && styles.tabActive]}
          onPress={() => setTab('sold')}
        >
          <Text style={[styles.tabText, tab === 'sold' && styles.tabTextActive]}>
            売却済 ({soldCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="🔍 商品名 / アドレスで検索..."
          placeholderTextColor="#ADB5BD"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Sort */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sortScroll}
        contentContainerStyle={styles.sortContainer}
      >
        {SORT_OPTIONS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.sortChip, sort === key && styles.sortChipActive]}
            onPress={() => setSort(key)}
          >
            <Text style={[styles.sortChipText, sort === key && styles.sortChipTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{tab === 'in-stock' ? '📦' : '✅'}</Text>
            <Text style={styles.emptyText}>
              {tab === 'in-stock'
                ? '在庫がありません\n仕入れタブから登録しましょう'
                : '売却済みの商品がありません'}
            </Text>
          </View>
        }
      />

      {/* Sell Modal */}
      <Modal visible={!!sellTarget} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>売却処理</Text>

            {sellTarget && (
              <>
                <Text style={styles.sheetItemName} numberOfLines={2}>
                  {sellTarget.name}
                </Text>
                <View style={styles.sheetMeta}>
                  <Text style={styles.sheetMetaText}>📍 {sellTarget.storageAddress}</Text>
                  <Text style={styles.sheetMetaText}>
                    仕入 {formatCurrency(sellTarget.purchasePrice)}
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>売却額（円）*</Text>
                <TextInput
                  style={styles.modalInput}
                  value={form.soldPrice}
                  onChangeText={(v) => setForm((f) => ({ ...f, soldPrice: v }))}
                  keyboardType="numeric"
                  placeholder="例: 3500"
                  placeholderTextColor="#ADB5BD"
                  autoFocus
                />

                <Text style={styles.fieldLabel}>送料（円）</Text>
                <TextInput
                  style={styles.modalInput}
                  value={form.shippingFee}
                  onChangeText={(v) => setForm((f) => ({ ...f, shippingFee: v }))}
                  keyboardType="numeric"
                  placeholder="例: 185"
                  placeholderTextColor="#ADB5BD"
                />

                {/* Fee row */}
                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>メルカリ手数料（10%）</Text>
                  <Text style={styles.feeValue}>
                    {soldPriceNum > 0 ? formatCurrency(mercariCommission) : '—'}
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>作業時間（分）</Text>
                <TextInput
                  style={styles.modalInput}
                  value={form.workMinutes}
                  onChangeText={(v) => setForm((f) => ({ ...f, workMinutes: v }))}
                  keyboardType="numeric"
                  placeholder="例: 20"
                  placeholderTextColor="#ADB5BD"
                />

                {/* Live profit preview */}
                {previewProfit !== null && soldPriceNum > 0 && (
                  <View
                    style={[
                      styles.profitPreview,
                      { backgroundColor: previewProfit >= 0 ? '#E8FFF1' : '#FFF0F0' },
                    ]}
                  >
                    <Text style={styles.profitPreviewLabel}>予想利益</Text>
                    <Text
                      style={[
                        styles.profitPreviewValue,
                        { color: previewProfit >= 0 ? '#00C853' : '#FF3B30' },
                      ]}
                    >
                      {formatCurrency(previewProfit)}
                    </Text>
                  </View>
                )}

                <View style={styles.modalBtns}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeSell}>
                    <Text style={styles.cancelBtnText}>キャンセル</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmBtn, selling && styles.confirmBtnDisabled]}
                    onPress={handleSell}
                    disabled={selling}
                  >
                    <Text style={styles.confirmBtnText}>
                      {selling ? '処理中...' : '売却確定 ✓'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F8',
  },
  tab: {
    flex: 1,
    paddingBottom: 12,
    alignItems: 'center',
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#00C853' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#ADB5BD' },
  tabTextActive: { color: '#00C853' },

  // Search
  searchWrap: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFFFFF' },
  searchInput: {
    backgroundColor: '#F0F4F8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#1A1A2E',
  },

  // Sort
  sortScroll: { backgroundColor: '#FFFFFF', maxHeight: 48 },
  sortContainer: { paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#DEE2E6',
    backgroundColor: '#F8F9FA',
  },
  sortChipActive: { borderColor: '#00C853', backgroundColor: '#E8FFF1' },
  sortChipText: { fontSize: 12, color: '#6C757D' },
  sortChipTextActive: { color: '#00C853', fontWeight: '700' },

  // List
  list: { padding: 12, paddingBottom: 24 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  addressBadge: {
    width: 52,
    height: 52,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  addressBadgeSold: { backgroundColor: '#F0F0F0' },
  addressText: { fontSize: 11, fontWeight: '800', color: '#3730A3', textAlign: 'center' },
  addressTextSold: { color: '#9E9E9E' },
  itemInfo: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#1A1A2E', marginBottom: 3 },
  itemMeta: { fontSize: 12, color: '#6C757D' },
  profitTag: { fontSize: 12, fontWeight: '700', marginTop: 3 },

  sellBtn: {
    backgroundColor: '#00C853',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    marginLeft: 10,
    flexShrink: 0,
  },
  sellBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  soldBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    marginLeft: 10,
    flexShrink: 0,
  },
  soldBadgeText: { fontSize: 12, color: '#9E9E9E', fontWeight: '600' },

  // Empty state
  empty: { alignItems: 'center', paddingVertical: 64 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#ADB5BD', fontSize: 15, textAlign: 'center', lineHeight: 24 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#DEE2E6',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A2E', marginBottom: 6 },
  sheetItemName: { fontSize: 15, color: '#495057', marginBottom: 4 },
  sheetMeta: { flexDirection: 'row', gap: 16, marginBottom: 4 },
  sheetMetaText: { fontSize: 13, color: '#6C757D' },

  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#495057',
    marginTop: 16,
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 17,
    color: '#1A1A2E',
    backgroundColor: '#F8F9FA',
  },

  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
  },
  feeLabel: { fontSize: 13, color: '#795548' },
  feeValue: { fontSize: 15, fontWeight: '700', color: '#F57C00' },

  profitPreview: {
    marginTop: 14,
    padding: 16,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profitPreviewLabel: { fontSize: 14, color: '#495057', fontWeight: '600' },
  profitPreviewValue: { fontSize: 26, fontWeight: '800' },

  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 22 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#DEE2E6',
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, color: '#6C757D', fontWeight: '600' },
  confirmBtn: {
    flex: 2,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: '#00C853',
    alignItems: 'center',
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { fontSize: 16, color: '#FFFFFF', fontWeight: '800' },
});
