import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { addItem, loadItems } from '../utils/storage';
import { suggestNextAddress } from '../utils/calculations';
import { InventoryItem } from '../types';

const PURCHASE_SOURCES = [
  'Amazon',
  'アリエク',
  'セカスト',
  'ハードオフ',
  'ブックオフ',
  'ヤフオク',
  'メルカリ',
  'ゲオ',
  'その他',
];

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function PurchaseScreen() {
  const [name, setName] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseFrom, setPurchaseFrom] = useState('');
  const [storageAddress, setStorageAddress] = useState('');
  const [suggestedAddress, setSuggestedAddress] = useState('A-1');
  const [occupiedAddresses, setOccupiedAddresses] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const refreshAddressState = useCallback(async () => {
    const items = await loadItems();
    const next = suggestNextAddress(items);
    setSuggestedAddress(next);
    setStorageAddress(next);
    setOccupiedAddresses(
      items
        .filter((i) => i.status === 'in-stock')
        .map((i) => i.storageAddress)
        .sort()
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshAddressState();
    }, [refreshAddressState])
  );

  const doSave = useCallback(async () => {
    setSaving(true);
    try {
      const item: InventoryItem = {
        id: makeId(),
        name: name.trim(),
        purchasePrice: Number(purchasePrice),
        purchaseFrom: purchaseFrom.trim() || 'その他',
        storageAddress: storageAddress.trim().toUpperCase(),
        status: 'in-stock',
        createdAt: new Date().toISOString(),
      };
      await addItem(item);
      Alert.alert(
        '登録完了 📦',
        `「${item.name}」\nアドレス ${item.storageAddress} に保管しました`
      );
      setName('');
      setPurchasePrice('');
      setPurchaseFrom('');
      await refreshAddressState();
    } finally {
      setSaving(false);
    }
  }, [name, purchasePrice, purchaseFrom, storageAddress, refreshAddressState]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('エラー', '商品名を入力してください');
      return;
    }
    const price = Number(purchasePrice);
    if (!purchasePrice || isNaN(price) || price < 0) {
      Alert.alert('エラー', '仕入額を正しく入力してください');
      return;
    }
    if (!storageAddress.trim()) {
      Alert.alert('エラー', '保管アドレスを入力してください');
      return;
    }

    const items = await loadItems();
    const conflict = items.find(
      (i) =>
        i.storageAddress === storageAddress.trim().toUpperCase() &&
        i.status === 'in-stock'
    );
    if (conflict) {
      Alert.alert(
        `${storageAddress.toUpperCase()} は使用中`,
        `「${conflict.name}」が保管されています。このアドレスで上書き登録しますか？`,
        [
          { text: 'キャンセル', style: 'cancel' },
          { text: '続ける', onPress: doSave },
        ]
      );
      return;
    }
    await doSave();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {/* 商品名 */}
          <Text style={styles.label}>商品名 *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="例: iPhone ケース ブラック"
            placeholderTextColor="#ADB5BD"
            returnKeyType="next"
          />

          {/* 仕入額 */}
          <Text style={styles.label}>仕入額（円）*</Text>
          <TextInput
            style={styles.input}
            value={purchasePrice}
            onChangeText={setPurchasePrice}
            keyboardType="numeric"
            placeholder="例: 1500"
            placeholderTextColor="#ADB5BD"
            returnKeyType="next"
          />

          {/* 仕入先 */}
          <Text style={styles.label}>仕入先</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsContainer}
          >
            {PURCHASE_SOURCES.map((src) => (
              <TouchableOpacity
                key={src}
                style={[styles.chip, purchaseFrom === src && styles.chipActive]}
                onPress={() => setPurchaseFrom(purchaseFrom === src ? '' : src)}
              >
                <Text style={[styles.chipText, purchaseFrom === src && styles.chipTextActive]}>
                  {src}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            value={purchaseFrom}
            onChangeText={setPurchaseFrom}
            placeholder="または直接入力"
            placeholderTextColor="#ADB5BD"
            returnKeyType="next"
          />

          {/* 保管アドレス */}
          <View style={styles.labelRow}>
            <Text style={styles.label}>保管アドレス *</Text>
            <Text style={styles.labelHint}>次の空き: {suggestedAddress}</Text>
          </View>
          <TextInput
            style={styles.input}
            value={storageAddress}
            onChangeText={setStorageAddress}
            placeholder="例: A-1"
            placeholderTextColor="#ADB5BD"
            autoCapitalize="characters"
          />

          {occupiedAddresses.length > 0 && (
            <View style={styles.occupiedBox}>
              <Text style={styles.occupiedTitle}>使用中のアドレス</Text>
              <Text style={styles.occupiedList}>{occupiedAddresses.join('　')}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={styles.submitBtnText}>{saving ? '登録中...' : '📦 仕入れ登録'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  content: { padding: 16, paddingBottom: 40 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#495057',
    marginTop: 20,
    marginBottom: 6,
  },
  labelHint: { fontSize: 12, color: '#00C853', fontWeight: '600' },

  input: {
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: '#1A1A2E',
    backgroundColor: '#F8F9FA',
  },

  chipsScroll: { marginTop: 4 },
  chipsContainer: { paddingRight: 16 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#DEE2E6',
    marginRight: 8,
    backgroundColor: '#F8F9FA',
  },
  chipActive: { borderColor: '#00C853', backgroundColor: '#E8FFF1' },
  chipText: { fontSize: 14, color: '#6C757D' },
  chipTextActive: { color: '#00C853', fontWeight: '700' },

  occupiedBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
  },
  occupiedTitle: { fontSize: 11, fontWeight: '600', color: '#F57C00', marginBottom: 4 },
  occupiedList: { fontSize: 13, color: '#795548', lineHeight: 20 },

  submitBtn: {
    marginTop: 28,
    backgroundColor: '#00C853',
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
});
