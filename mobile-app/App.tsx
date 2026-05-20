import React from 'react';
import { Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';

import DashboardScreen from './src/screens/DashboardScreen';
import PurchaseScreen from './src/screens/PurchaseScreen';
import InventoryScreen from './src/screens/InventoryScreen';

const Tab = createBottomTabNavigator();

function TabIcon({ emoji, active }: { emoji: string; active: boolean }) {
  return (
    <View style={{ opacity: active ? 1 : 0.45 }}>
      <Text style={{ fontSize: 24 }}>{emoji}</Text>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#F0F4F8',
            borderTopWidth: 1,
            height: 72,
            paddingBottom: 14,
            paddingTop: 8,
          },
          tabBarActiveTintColor: '#00C853',
          tabBarInactiveTintColor: '#ADB5BD',
          tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTitleStyle: { fontWeight: '800', fontSize: 18, color: '#1A1A2E' },
          headerShadowVisible: false,
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            title: 'ダッシュボード',
            tabBarLabel: 'ホーム',
            tabBarIcon: ({ focused }) => <TabIcon emoji="📊" active={focused} />,
          }}
        />
        <Tab.Screen
          name="Purchase"
          component={PurchaseScreen}
          options={{
            title: '仕入れ登録',
            tabBarLabel: '仕入れ',
            tabBarIcon: ({ focused }) => <TabIcon emoji="📦" active={focused} />,
          }}
        />
        <Tab.Screen
          name="Inventory"
          component={InventoryScreen}
          options={{
            title: '在庫リスト',
            tabBarLabel: '在庫',
            tabBarIcon: ({ focused }) => <TabIcon emoji="📋" active={focused} />,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
