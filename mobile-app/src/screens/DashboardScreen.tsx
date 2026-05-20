import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadItems } from '../utils/storage';
import {
  calcStats,
  EARTH_CIRCUMFERENCE_KM,
  TOKYO_OSAKA_KM,
  formatCurrency,
  formatMinutes,
} from '../utils/calculations';
import { DashboardStats } from '../types';

const { width } = Dimensions.get('window');

const EMPTY_STATS: DashboardStats = {
  totalItems: 0,
  inStockCount: 0,
  soldCount: 0,
  totalProfit: 0,
  totalWorkMinutes: 0,
  hourlyRate: 0,
  totalDistance: 0,
  earthLaps: 0,
};

export default function DashboardScreen() {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    const items = await loadItems();
    setStats(calcStats(items));
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const lapProgress = stats.earthLaps % 1;
  const completedLaps = Math.floor(stats.earthLaps);
  const tokyoOsakaTrips = Math.floor(stats.totalDistance / TOKYO_OSAKA_KM);
  const kmToNextLap = Math.round((1 - lapProgress) * EARTH_CIRCUMFERENCE_KM);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E676" />}
    >
      {/* ── Earth Counter Hero Card ── */}
      <View style={styles.earthCard}>
        <Text style={styles.earthLabel}>🌍 大移動カウンター</Text>

        <View style={styles.earthMainRow}>
          <Text style={styles.earthPrefix}>地球</Text>
          <Text style={styles.earthLapsNum}>{stats.earthLaps.toFixed(3)}</Text>
          <Text style={styles.earthSuffix}>周</Text>
        </View>

        <Text style={styles.earthKm}>
          総移動距離&nbsp;
          {stats.totalDistance.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}&nbsp;km
        </Text>

        {/* Progress bar for current lap */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: Math.max(lapProgress * (width - 80), 4) },
            ]}
          />
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressSub}>{completedLaps}周目 完了</Text>
          <Text style={styles.progressSub}>次の周まで {kmToNextLap.toLocaleString()} km</Text>
        </View>

        <View style={styles.tokyoOsakaBadge}>
          <Text style={styles.tokyoOsakaText}>
            🚄 東京↔大阪 × {tokyoOsakaTrips.toLocaleString()} 回分
          </Text>
        </View>
      </View>

      {/* ── Financial Stats ── */}
      <Text style={styles.sectionTitle}>💰 収支サマリー</Text>
      <View style={styles.row}>
        <StatCard
          label="総利益"
          value={formatCurrency(stats.totalProfit)}
          color={stats.totalProfit >= 0 ? '#00C853' : '#FF3B30'}
          large
        />
        <StatCard
          label="稼働時給"
          value={stats.hourlyRate > 0 ? `${formatCurrency(stats.hourlyRate)}/h` : '—'}
          color="#2979FF"
          large
        />
      </View>

      <View style={styles.row}>
        <StatCard label="在庫中" value={`${stats.inStockCount} 点`} />
        <StatCard label="売却済" value={`${stats.soldCount} 点`} />
        <StatCard
          label="総作業時間"
          value={stats.totalWorkMinutes > 0 ? formatMinutes(stats.totalWorkMinutes) : '—'}
        />
      </View>

      {stats.totalItems === 0 && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>
            「仕入れ」タブから商品を登録すると{'\n'}ここにデータが表示されます 📦
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function StatCard({
  label,
  value,
  color = '#1A1A2E',
  large = false,
}: {
  label: string;
  value: string;
  color?: string;
  large?: boolean;
}) {
  return (
    <View style={[styles.statCard, large && styles.statCardLarge]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }, large && styles.statValueLarge]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  content: { paddingBottom: 32 },

  // Earth card
  earthCard: {
    margin: 16,
    padding: 24,
    backgroundColor: '#1A1A2E',
    borderRadius: 24,
    alignItems: 'center',
  },
  earthLabel: { color: '#9EA3B0', fontSize: 13, marginBottom: 12 },
  earthMainRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4 },
  earthPrefix: { color: '#FFFFFF', fontSize: 20, fontWeight: '600', marginBottom: 6 },
  earthLapsNum: { color: '#00E676', fontSize: 52, fontWeight: '800', lineHeight: 58, marginHorizontal: 4 },
  earthSuffix: { color: '#FFFFFF', fontSize: 20, fontWeight: '600', marginBottom: 6 },
  earthKm: { color: '#9EA3B0', fontSize: 13, marginBottom: 16 },

  progressTrack: {
    width: '100%',
    height: 10,
    backgroundColor: '#2D2D42',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00E676',
    borderRadius: 5,
  },
  progressLabels: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressSub: { color: '#9EA3B0', fontSize: 11 },

  tokyoOsakaBadge: {
    marginTop: 16,
    backgroundColor: '#2D2D42',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tokyoOsakaText: { color: '#FFD54F', fontSize: 13, fontWeight: '600' },

  // Section
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    marginHorizontal: 16,
    marginBottom: 10,
    marginTop: 4,
  },
  row: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 10 },

  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statCardLarge: { paddingVertical: 20 },
  statLabel: { fontSize: 11, color: '#6C757D', marginBottom: 6 },
  statValue: { fontSize: 16, fontWeight: '700' },
  statValueLarge: { fontSize: 22 },

  hint: {
    marginTop: 24,
    alignItems: 'center',
  },
  hintText: { color: '#ADB5BD', fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
