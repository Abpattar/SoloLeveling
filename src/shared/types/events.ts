/**
 * INTEGRATION CONTRACT: TYPE-EVT-001, TYPE-EVT-002
 * Purpose: the closed set of app-wide events. Emitters and subscribers are fixed by the contract.
 * Canonical definition: SHARED_CONTRACT.md §3.10 / §3.12
 * Consumers: every module that emits or reacts to a change
 * Contract status: APPROVED
 */
import type { Id, LocalDate } from './common';
import type { SessionStatus } from './training';

export interface AppEventMap {
  'settings.changed': { keys: string[] }; // top-level AppSettings keys touched
  'food.entry.saved': { entryId: Id; mealCategoryId: Id; localDate: LocalDate };
  'food.entry.deleted': { entryId: Id; localDate: LocalDate };
  'session.saved': { sessionId: Id; localDate: LocalDate; status: SessionStatus };
  'exercises.changed': Record<string, never>;
  'data.restored': Record<string, never>;
}

export type AppEventName = keyof AppEventMap;