import React, { useEffect } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BanksScreen } from './features/banks/BanksScreen';
import { DashboardScreen } from './features/dashboard/DashboardScreen';
import { InsightsScreen } from './features/insights/InsightsScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { TransactionsScreen } from './features/transactions/TransactionsScreen';
import { useApp } from './state/store';
import { Txt } from './ui/components';
import { SPACE, useTheme } from './ui/theme';

const Tab = createBottomTabNavigator();

/**
 * Tab glyphs are drawn from geometric primitives rather than an icon font, so
 * the app carries no icon dependency and the marks stay crisp at any density.
 * Each is paired with its label, so the shape never has to carry meaning alone.
 */
function TabGlyph({ name, focused, color }: { name: string; focused: boolean; color: string }) {
  const bars = name === 'Overview' ? [8, 14, 11] : name === 'Banks' ? [12, 12, 12] : null;

  if (bars) {
    return (
      <View style={styles.glyphRow}>
        {bars.map((height, index) => (
          <View
            key={index}
            style={{
              width: 3.5, height, borderRadius: 2, backgroundColor: color,
              opacity: focused ? 1 : 0.75,
            }}
          />
        ))}
      </View>
    );
  }

  if (name === 'Activity') {
    return (
      <View style={styles.glyphCol}>
        {[14, 10, 14].map((width, index) => (
          <View key={index} style={{ width, height: 2.5, borderRadius: 2, backgroundColor: color, opacity: focused ? 1 : 0.75 }} />
        ))}
      </View>
    );
  }

  if (name === 'Insights') {
    return (
      <View style={[styles.glyphDiamond, { borderColor: color, backgroundColor: focused ? color : 'transparent' }]} />
    );
  }

  return (
    <View style={[styles.glyphRing, { borderColor: color, borderWidth: focused ? 4 : 2 }]} />
  );
}

export default function App() {
  const theme = useTheme();
  const bootstrap = useApp(state => state.bootstrap);

  useEffect(() => { void bootstrap(); }, [bootstrap]);

  const navTheme = {
    ...(theme.mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.mode === 'dark' ? DarkTheme : DefaultTheme).colors,
      background: theme.plane,
      card: theme.surface,
      text: theme.textPrimary,
      border: theme.border,
      primary: theme.textPrimary,
    },
  };

  return (
    <SafeAreaProvider>
      {/* Android is edge-to-edge from RN 0.87, so the bar only needs its style;
          screens pay for the inset themselves via useSafeAreaInsets. */}
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: theme.textPrimary,
            tabBarInactiveTintColor: theme.textMuted,
            tabBarStyle: {
              backgroundColor: theme.surface,
              borderTopColor: theme.border,
              height: 64,
              paddingTop: SPACE.sm,
              paddingBottom: SPACE.sm,
            },
            tabBarLabel: ({ color }) => (
              <Txt variant="caption" style={{ color }}>{route.name}</Txt>
            ),
            tabBarIcon: ({ focused, color }) => (
              <TabGlyph name={route.name} focused={focused} color={color} />
            ),
          })}>
          <Tab.Screen name="Overview" component={DashboardScreen} />
          <Tab.Screen name="Banks" component={BanksScreen} />
          <Tab.Screen name="Activity" component={TransactionsScreen} />
          <Tab.Screen name="Insights" component={InsightsScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  glyphRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2.5, height: 16 },
  glyphCol: { gap: 2.5, alignItems: 'flex-start', justifyContent: 'center', height: 16 },
  glyphDiamond: { width: 12, height: 12, borderWidth: 2, borderRadius: 2, transform: [{ rotate: '45deg' }] },
  glyphRing: { width: 15, height: 15, borderRadius: 8 },
});
