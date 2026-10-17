/**
 * INTEGRATION CONTRACT: HOOK-PHOTO-001
 * Purpose: the active journey and today's day number, reloaded on focus and after a restore. This is
 *          what the Today header, the milestone card and the journeys screen read.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (HOOK-PHOTO-001)
 * Consumers: src/shell/TodayScreen.tsx (A7), Photos screens (A5)
 * Contract status: APPROVED
 */
import { useCallback } from 'react';
// CONTRACT: HOOK-UI-002 (A1) — loads on mount, on focus and after a restore
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { getDayNumber, todayLocal } from '@/shared/utils/dates';
// API-PHOTO-001 (A5 self)
import { getActiveJourney } from '../data/journeyRepository';
import type { Journey } from '@/shared/types/photos';

export interface ActiveJourneyState {
  journey: Journey | null;
  dayNumber: number | null;
  loading: boolean;
  reload(): void;
}

export function useActiveJourney(): ActiveJourneyState {
  const load = useCallback(async (): Promise<Journey | null> => getActiveJourney(), []);
  const { data, loading, reload } = useFocusLoad(load, []);

  return {
    journey: data ?? null,
    dayNumber: data ? getDayNumber(data.startDate, todayLocal()) : null,
    loading,
    reload,
  };
}