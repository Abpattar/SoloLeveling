/**
 * INTEGRATION CONTRACT: A7 root layout (SHARED_CONTRACT.md §4, `_layout.tsx` row)
 * Purpose: provider stack, first-launch gate and the single Stack. Every title in the app is set
 *          here, once, so no route file carries presentation.
 * Consumers: expo-router
 * Contract status: APPROVED
 */
import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
// CMP-SHELL-001/005 (A7 self) - providers, bootstrap gate and the onboarding redirect
import { AppProviders, SetupGate } from '@/shell';
// CONTRACT: HOOK-REM-001 (A2) - routes a tapped reminder, including on a cold start
import { useReminderNotificationRouting } from '@/modules/reminders';
import { useTheme } from '@/shared/ui/theme';

function RootNavigator(): React.JSX.Element {
  // A hook cannot run in the layout function itself, so the Stack lives in a child component.
  useReminderNotificationRouting();
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { color: theme.colors.text },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ title: 'Welcome', headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="exercise/new" options={{ title: 'New exercise' }} />
      <Stack.Screen name="exercise/[exerciseId]" options={{ title: 'Edit exercise' }} />
      <Stack.Screen name="session/run" options={{ title: 'Session', headerShown: false }} />
      <Stack.Screen name="session/history" options={{ title: 'Session history' }} />
      <Stack.Screen name="session/[sessionId]" options={{ title: 'Session' }} />
      <Stack.Screen name="session/complete/[sessionId]" options={{ title: 'Session summary' }} />
      <Stack.Screen name="food/capture" options={{ title: 'Meal photo' }} />
      <Stack.Screen name="food/entry/[entryId]" options={{ title: 'Log food' }} />
      <Stack.Screen name="food/categories" options={{ title: 'Meals' }} />
      <Stack.Screen name="photos/capture" options={{ title: 'Progress photo' }} />
      <Stack.Screen name="photos/compare/[journeyId]/[milestoneDay]" options={{ title: 'Compare' }} />
      <Stack.Screen name="photos/timeline/[journeyId]" options={{ title: 'Timeline' }} />
      <Stack.Screen name="photos/journeys" options={{ title: 'Journeys' }} />
      <Stack.Screen name="measurements" options={{ title: 'Measurements' }} />
      <Stack.Screen name="journal/index" options={{ title: 'Journal' }} />
      <Stack.Screen name="journal/[entryId]" options={{ title: 'Journal entry' }} />
      <Stack.Screen name="summary/[date]" options={{ title: 'Daily summary' }} />
      <Stack.Screen name="backup" options={{ title: 'Backup' }} />
    </Stack>
  );
}

export default function RootLayout(): React.JSX.Element {
  return (
    <AppProviders>
      <SetupGate>
        <StatusBar style="auto" />
        <RootNavigator />
      </SetupGate>
    </AppProviders>
  );
}
