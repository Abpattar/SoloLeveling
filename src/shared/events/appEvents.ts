/**
 * INTEGRATION CONTRACT: API-EVT-001, HOOK-EVT-001
 * Purpose: the only cross-module "something happened" mechanism. Emitters and subscribers are fixed
 *          by SHARED_CONTRACT §3.12. A throwing handler is logged and isolated, never propagated.
 * Canonical definition: SHARED_CONTRACT.md §2.9, §3.10, §3.12
 * Consumers: A1 SettingsProvider/useFocusLoad, reminders (A2), food (A3), backup (A4), photos (A5)
 * Contract status: APPROVED
 */
import { useEffect, useRef } from 'react';
import { logger } from '../utils/logger';
import type { Unsubscribe } from '../types/common';
import type { AppEventMap, AppEventName } from '../types/events';

type Handler<K extends AppEventName> = (payload: AppEventMap[K]) => void;

const listeners = new Map<AppEventName, Set<Handler<AppEventName>>>();

/** API-EVT-001 */
export const appEvents = {
  on<K extends AppEventName>(name: K, handler: Handler<K>): Unsubscribe {
    let set = listeners.get(name);
    if (!set) {
      set = new Set();
      listeners.set(name, set);
    }
    const typed = handler as Handler<AppEventName>;
    set.add(typed);
    return () => {
      set?.delete(typed);
    };
  },

  emit<K extends AppEventName>(name: K, payload: AppEventMap[K]): void {
    const set = listeners.get(name);
    if (!set) {
      return;
    }
    // Copy first: a handler may unsubscribe itself while we iterate.
    for (const handler of Array.from(set)) {
      try {
        (handler as Handler<K>)(payload);
      } catch (e) {
        logger.warn('An app event handler threw.', { event: String(name), error: String(e) });
      }
    }
  },
};

/** HOOK-EVT-001 */
export function useAppEvent<K extends AppEventName>(name: K, handler: Handler<K>): void {
  const latest = useRef(handler);
  // Written in an effect, never during render, so the ref never drives a render pass.
  useEffect(() => {
    latest.current = handler;
  });

  useEffect(() => {
    return appEvents.on(name, (payload) => {
      (latest.current as Handler<K>)(payload as AppEventMap[K]);
    });
  }, [name]);
}