/**
 * INTEGRATION CONTRACT: internal (A2 reminders)
 * Purpose: the ONLY file in the app that imports `expo-notifications`. Everything above it works
 *          with `PlannedReminder` values and never touches the native API.
 * Canonical definition: SHARED_CONTRACT.md §1 and §9
 * Consumers: reminderService.ts, useReminderNotificationRouting.ts
 * Contract status: APPROVED (internal symbol, no registry ID)
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { logger } from '@/shared/utils/logger';
import type { NotificationPermissionState, PlannedReminder } from './types';

export const REMINDER_CHANNEL_ID = 'reminders';
const IDENTIFIER_PREFIX = 'rem:';

/** Shows reminders as a banner while the app is open, instead of silently dropping them. */
export function setForegroundHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function getPermissionState(): Promise<NotificationPermissionState> {
  const status = await Notifications.getPermissionsAsync();
  return normalize(status.granted, status.canAskAgain);
}

export async function requestPermission(): Promise<NotificationPermissionState> {
  const status = await Notifications.requestPermissionsAsync();
  return normalize(status.granted, status.canAskAgain);
}

function normalize(granted: boolean, canAskAgain: boolean): NotificationPermissionState {
  if (granted) {
    return 'granted';
  }
  return canAskAgain ? 'undetermined' : 'denied';
}

export async function cancelAllManagedReminders(): Promise<number> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const ours = scheduled.filter(
    (item) => typeof item.content.data?.identifier === 'string'
      ? String(item.content.data.identifier).startsWith(IDENTIFIER_PREFIX)
      : false,
  );
  for (const item of ours) {
    try {
      await Notifications.cancelScheduledNotificationAsync(item.identifier);
    } catch (e) {
      logger.warn('A reminder could not be cancelled.', { error: String(e) });
    }
  }
  return ours.length;
}

export async function scheduleReminder(reminder: PlannedReminder): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: reminder.identifier,
    content: {
      title: reminder.title,
      body: reminder.body,
      data: { identifier: reminder.identifier, route: reminder.route },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminder.fireAt,
      ...(Platform.OS === 'android'
        ? { channelId: REMINDER_CHANNEL_ID, alarmManager: { allowWhileIdle: true } }
        : {}),
    },
  });
}

/** The identifier of the notification that launched or last updated the app, if any. */
export async function getLastNotificationResponseAsync(): Promise<{
  route: string | null;
}> {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    const data = response?.notification.request.content.data as
      | { route?: unknown }
      | undefined;
    const route = typeof data?.route === 'string' ? data.route : null;
    return { route };
  } catch (e) {
    logger.warn('The last notification could not be read.', { error: String(e) });
    return { route: null };
  }
}

export function subscribeToNotificationResponses(
  handler: (route: string) => void,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as { route?: unknown } | undefined;
    if (typeof data?.route === 'string' && data.route.startsWith('/')) {
      handler(data.route);
    }
  });
  return () => subscription.remove();
}