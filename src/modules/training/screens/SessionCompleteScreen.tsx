/**
 * INTEGRATION CONTRACT: CMP-TRN-004
 * Purpose: post-session summary plus the reflection (effort, notes, symptom checklist). Ticking any
 *          symptom or reaching the user's own pain alert level immediately shows the fixed
 *          stop-and-contact advice. The exercise plan is never modified from here.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-TRN-004), SAF-03, REQ-SES-003/004
 * Consumers: src/app/session/complete/[sessionId].tsx (A7)
 * Contract status: APPROVED
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
// CONTRACT: API-TRN-009/012 (A2) — load and reflect on the finished session
import { getSession, updateSessionReflection } from '@/modules/training';
// CONTRACT: CMP-PHOTO-007 (A5) — optional post-session progress-photo prompt
import { ProgressPhotoPromptCard } from '@/modules/photos';
// CONTRACT: API-SAFE-001 (A1) — the only place advice is decided
import { evaluateSymptomReport } from '@/shared/domain/safety';
// CONTRACT: HOOK-SET-001 (A1) — display + safety settings
import { useSettings } from '@/shared/settings/SettingsProvider';
// CONST-TEXT-006 (A1) — the fixed workout-calorie label
import { WORKOUT_KCAL_LABEL } from '@/shared/constants/text';
// CONTRACT: CONST-NAV-001 (A1) � route builders
import { ROUTES } from '@/shared/navigation/routes';
// CMP-SAFE-001/002 (A1) — symptom checklist and advice card
import { SafetyAdviceCard, SymptomChecklist } from '@/shared/ui/safetyUi';
import { Screen } from '@/shared/ui/Screen';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Chip } from '@/shared/ui/Chip';
import { TextField } from '@/shared/ui/fields';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/ui/feedback';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { useTheme } from '@/shared/ui/theme';
import { toAppError } from '@/shared/errors/AppError';
import type { Session } from '@/shared/types/training';
import type { SymptomReport } from '@/shared/types/safety';

export interface SessionCompleteScreenProps {
  sessionId: string;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  return `${minutes} min`;
}

export function SessionCompleteScreen({ sessionId }: SessionCompleteScreenProps): React.JSX.Element {
  const theme = useTheme();
  const { settings } = useSettings();
  const [effort, setEffort] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [report, setReport] = useState<SymptomReport>({ flags: [], painScore: null });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<Session> => getSession(sessionId), [sessionId]);
  const { data: session, loading, error } = useFocusLoad(load, [sessionId]);

  const advice = useMemo(
    () => evaluateSymptomReport(report, settings.safety.painAlertLevel),
    [report, settings.safety.painAlertLevel],
  );

  const save = async (): Promise<void> => {
    setSaving(true);
    setSaveError(null);
    try {
      await updateSessionReflection(sessionId, {
        effortRating: effort,
        notes: notes.trim().length > 0 ? notes.trim() : null,
        painScore: report.painScore,
        symptomFlags: report.flags,
      });
      router.replace(ROUTES.today);
    } catch (e) {
      setSaveError(toAppError(e).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !session) {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen>
        <ErrorBanner error={error} />
        <EmptyState
          title="Session not found"
          message="It may have been removed."
          action={{ label: 'Back to Today', onPress: () => router.replace(ROUTES.today) }}
        />
      </Screen>
    );
  }

  const showKcal = settings.display.showCalorieEstimates && session.estimatedKcal !== null;

  return (
    <Screen>
      <AppText variant="title">Session saved</AppText>
      <ErrorBanner error={error} />

      <Card>
        <AppText variant="heading" style={{ marginBottom: 0 }}>
          {formatDuration(session.totalDurationSeconds)} ·{' '}
          {session.status === 'completed' ? 'completed' : 'stopped early'}
        </AppText>
        {session.results.map((result) => (
          <AppText key={result.id} variant="caption" muted>
            {result.exerciseName}: {result.completedSets}/{result.plannedSets} sets
            {result.completedReps !== null ? `, ${result.completedReps} reps` : ''}
            {result.status !== 'completed' ? ` (${result.status})` : ''}
          </AppText>
        ))}
        {showKcal ? (
          <AppText variant="caption" muted>
            {WORKOUT_KCAL_LABEL}: ≈ {session.estimatedKcal} kcal
          </AppText>
        ) : null}
      </Card>

      <AppText variant="heading">How hard was it?</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
          <Chip
            key={value}
            label={String(value)}
            selected={effort === value}
            onPress={() => setEffort(value)}
          />
        ))}
      </View>

      <TextField
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="How it felt, anything your clinician should know"
      />

      <SymptomChecklist value={report} onChange={setReport} />
      {advice ? <SafetyAdviceCard advice={advice} /> : null}

      {saveError ? <ErrorBanner error={saveError} /> : null}

      <View style={{ gap: theme.spacing.sm }}>
        <Button label="Save" onPress={() => void save()} loading={saving} />
        <Button
          label="Done"
          variant="secondary"
          onPress={() => router.replace(ROUTES.today)}
          disabled={saving}
        />
      </View>

      {/* CONTRACT: CMP-PHOTO-007 (A5) — optional post-session photo prompt; Skip never blocks. */}
      <ProgressPhotoPromptCard sessionId={sessionId} />

      <AppText variant="caption" muted>
        Your exercise plan stays exactly as you entered it.
      </AppText>
    </Screen>
  );
}