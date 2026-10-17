/**
 * INTEGRATION CONTRACT: internal (A2 reminders)
 * Purpose: routes a tapped reminder to the screen its `data.route` names, including a cold start.
 *          Only strings produced by `ROUTES` are accepted.
 * Canonical definition: SHARED_CONTRACT.md §9, AGENT_02_PROMPT.md §3
 * Consumers: src/app/_layout.tsx (A7)
 * Contract status: APPROVED (internal symbol, no registry ID)
 */
import { useEffect } from 'react';
import { router } from 'expo-router';
import {
  getLastNotificationResponseAsync,
  subscribeToNotificationResponses,
} from './notifications';

export function useReminderNotificationRouting(): void {
  useEffect(() => {
    let cancelled = false;

    const off = subscribeToNotificationResponses((route) => {
      router.push(route);
    });

    // A cold start has no "response received" event, so the last response is read once.
    void getLastNotificationResponseAsync().then(({ route }) => {
      if (!cancelled && route) {
        router.push(route);
      }
    });

    return () => {
      cancelled = true;
      off();
    };
  }, []);
}