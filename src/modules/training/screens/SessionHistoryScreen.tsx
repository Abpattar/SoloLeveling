/**
 * INTEGRATION CONTRACT: CMP-TRN-005
 * Purpose: session history grouped by calendar day, newest first.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-TRN-005), REQ-SES-005
 * Consumers: src/app/session/history.tsx (A7)
 * Contract status: APPROVED
 */
import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
// CONTRACT: API-TRN-010 (A2) — history list
import { listSessions } from '@/modules/training';
import { ROUTES } from '@/shared/navigation/routes';
import { Screen } from '@/shared/ui/Screen';
import { AppText } from '@/shared/ui/AppText';
import { Card } from '@/shared/ui/Card';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/ui/feedback';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { formatDisplayDate, todayLocal } from '@/shared/utils/dates';
import type { Session } from '@/shared/types/training';
import type { LocalDate } from '@/shared/types/common';

function formatDuration(totalSeconds: number): string {
  return `${Math.round(totalSeconds / 60)} min`;
}

function groupByDate(sessions: Session[]): Array<[LocalDate, Session[]]> {
  const groups = new Map<LocalDate, Session[]>();
  for (const session of sessions) {
    const list = groups.get(session.localDate) ?? [];
    list.push(session);
    groups.set(session.localDate, list);
  }
  return Array.from(groups.entries());
}

export function SessionHistoryScreen(): React.JSX.Element {
  const load = useCallback(async (): Promise<Session[]> => listSessions({ limit: 200 }), []);
  const { data, loading, error } = useFocusLoad(load, []);
  const groups = useMemo(() => groupByDate(data ?? []), [data]);

  return (
    <Screen>
      <AppText variant="title">Session history</AppText>
      <ErrorBanner error={error} />
      {loading && !data ? <LoadingView /> : null}

      {!loading && groups.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          message="Finish a session and it will show up here."
          action={{ label: 'Back', onPress: () => router.back() }}
        />
      ) : null}

      {groups.map(([date, sessions]) => (
        <View key={date}>
          <AppText variant="heading">
            {date === todayLocal() ? `Today · ${formatDisplayDate(date)}` : formatDisplayDate(date)}
          </AppText>
          {sessions.map((session) => (
            <Card key={session.id} onPress={() => router.push(ROUTES.sessionDetail(session.id))}>
              <AppText variant="heading" style={{ marginBottom: 0 }}>
                {session.status === 'completed' ? 'Completed' : 'Stopped early'} ·{' '}
                {formatDuration(session.totalDurationSeconds)}
              </AppText>
              <AppText variant="caption" muted>
                {session.results.length} exercise{session.results.length === 1 ? '' : 's'}
                {session.results
                  .slice(0, 3)
                  .map((r) => ` · ${r.exerciseName}`)
                  .join('')}
              </AppText>
            </Card>
          ))}
        </View>
      ))}
    </Screen>
  );
}