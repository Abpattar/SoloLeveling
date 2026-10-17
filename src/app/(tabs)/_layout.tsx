/**
 * INTEGRATION CONTRACT: A7 tab layout (SHARED_CONTRACT.md §4, `(tabs)/_layout.tsx` row)
 * Purpose: the five bottom tabs, in the fixed order, with text-only icons so the app needs no icon
 *          font and no extra dependency.
 * Consumers: expo-router
 * Contract status: APPROVED
 */
import React from 'react';
import { Tabs } from 'expo-router';
import { AppText } from '@/shared/ui/AppText';
import { useTheme } from '@/shared/ui/theme';

const TABS = [
  { name: 'index', title: 'Today', glyph: '●' },
  { name: 'exercises', title: 'Exercises', glyph: '▲' },
  { name: 'food', title: 'Food', glyph: '■' },
  { name: 'photos', title: 'Photos', glyph: '◆' },
  { name: 'progress', title: 'Progress', glyph: '✦' },
] as const;

export default function TabsLayout(): React.JSX.Element {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { color: theme.colors.text },
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color }) => (
              <AppText style={{ color, marginBottom: 0 }}>{tab.glyph}</AppText>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
