/**
 * INTEGRATION CONTRACT: CMP-SHELL-004
 * Purpose: first-launch onboarding in three steps: the disclaimer, height/units/optional weight,
 *          then the Day 1 start date that creates Journey 1. Resumable — until the user commits a
 *          step, the visible step is derived from what the profile already stores.
 * Canonical definition: SHARED_CONTRACT.md §5, SHARED_SYMBOL_REGISTRY.md (CMP-SHELL-004)
 * Consumers: src/app/onboarding.tsx
 * Contract status: APPROVED
 */
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
// CONTRACT: API-SET-001..004 (A1) - profile read/write, disclaimer, completion
import {
  acknowledgeDisclaimer,
  completeOnboarding,
  getProfile,
  updateProfile,
} from '@/shared/data/profileRepository';
// CONTRACT: API-PHOTO-002 (A5) - creates Journey 1; rejects a future start date
import { createFirstJourney } from '@/modules/photos';
// CONTRACT: CONST-NAV-001 (A1) - route builders
import { ROUTES } from '@/shared/navigation/routes';
// CONTRACT: CONST-TEXT-001 (A1) - the verbatim health disclaimer
import { HEALTH_DISCLAIMER_TEXT } from '@/shared/constants/text';
// CONTRACT: API-CORE-002/008 (A1) - readable failures, AppError at the boundary
import { AppError, toAppError } from '@/shared/errors/AppError';
// CONTRACT: API-DATE-001/002/011 (A1) - local dates
import { isValidLocalDate, todayLocal } from '@/shared/utils/dates';
// CONTRACT: API-UNIT-001/002 (A1) - the only place units are converted
import { kgToLb, lbToKg } from '@/shared/utils/units';
// CONTRACT: CMP-UI-001..010/013/014 (A1)
import { Screen } from '@/shared/ui/Screen';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Chip, Segmented } from '@/shared/ui/Chip';
import { DateField, NumberField } from '@/shared/ui/fields';
import { ErrorBanner, LoadingView } from '@/shared/ui/feedback';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { useTheme } from '@/shared/ui/theme';
import type { LocalDate } from '@/shared/types/common';
import type { Profile, UnitSystem } from '@/shared/types/profile';

type Step = 'disclaimer' | 'profile' | 'startDate';

const START_DATE_NOTE =
  'Day 1 is the date you choose. Day 30, 60 and 90 unlock your progress photos.';
const HEIGHT_ERROR = 'Enter a height between 50 cm and 260 cm.';
const WEIGHT_ERROR = 'Enter a weight between 20 kg and 400 kg.';

/** The first step whose answer is not already stored, so an interrupted onboarding resumes. */
export function firstIncompleteOnboardingStep(profile: Profile): Step {
  if (profile.disclaimerAcknowledgedAt === null) {
    return 'disclaimer';
  }
  if (profile.heightCm === null) {
    return 'profile';
  }
  return 'startDate';
}

function DisclaimerStep({
  alreadyAcknowledged,
  onDone,
  onError,
}: {
  alreadyAcknowledged: boolean;
  onDone(): void;
  onError(message: string): void;
}): React.JSX.Element {
  const [understood, setUnderstood] = useState(alreadyAcknowledged);
  const [busy, setBusy] = useState(false);

  const accept = async (): Promise<void> => {
    setBusy(true);
    try {
      await acknowledgeDisclaimer();
      onDone();
    } catch (e) {
      onError(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <AppText variant="heading" style={{ marginBottom: 0 }}>
        Before you start
      </AppText>
      <AppText variant="caption" muted>
        {HEALTH_DISCLAIMER_TEXT}
      </AppText>
      <Chip
        label={understood ? 'I understand' : 'I have read this'}
        selected={understood}
        onPress={() => setUnderstood((v) => !v)}
      />
      <Button label="Continue" onPress={() => void accept()} disabled={!understood} loading={busy} />
    </Card>
  );
}

function ProfileStep({
  profile,
  onDone,
  onBack,
  onError,
}: {
  profile: Profile;
  onDone(): void;
  onBack(): void;
  onError(message: string): void;
}): React.JSX.Element {
  const theme = useTheme();
  // Initial state comes straight from the stored row, so no effect is needed to sync the form.
  const [units, setUnits] = useState<UnitSystem>(profile.unitSystem);
  const [heightCm, setHeightCm] = useState<number | null>(profile.heightCm);
  const [weight, setWeight] = useState<number | null>(
    profile.baselineWeightKg === null
      ? null
      : Number(
          (profile.unitSystem === 'imperial' ? kgToLb(profile.baselineWeightKg) : profile.baselineWeightKg)
            .toFixed(1),
        ),
  );
  const [heightError, setHeightError] = useState<string | null>(null);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (): Promise<void> => {
    setBusy(true);
    setHeightError(null);
    setWeightError(null);
    try {
      if (heightCm === null || heightCm < 50 || heightCm > 260) {
        setHeightError(HEIGHT_ERROR);
        return;
      }
      // The weight field is in the selected unit; the row always stores kilograms.
      const enteredKg = units === 'imperial' && weight !== null ? lbToKg(weight) : weight;
      if (enteredKg !== null && (enteredKg < 20 || enteredKg > 400)) {
        setWeightError(WEIGHT_ERROR);
        return;
      }
      await updateProfile({
        heightCm,
        unitSystem: units,
        baselineWeightKg: enteredKg === null ? null : Number(enteredKg.toFixed(2)),
      });
      onDone();
    } catch (e) {
      onError(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <AppText variant="heading" style={{ marginBottom: 0 }}>
        About you
      </AppText>
      <AppText variant="label" muted>
        Units
      </AppText>
      <Segmented<UnitSystem>
        options={[
          { value: 'metric', label: 'Metric (cm, kg)' },
          { value: 'imperial', label: 'Imperial (ft, lb)' },
        ]}
        value={units}
        onChange={setUnits}
      />
      <View style={{ height: 8 }} />
      <NumberField
        label="Height"
        value={heightCm}
        onChange={(v) => {
          setHeightCm(v);
          setHeightError(null);
        }}
        min={50}
        max={260}
        unit="cm"
        error={heightError}
      />
      {units === 'imperial' ? (
        <AppText variant="caption" muted>
          Height is always entered in centimetres, even with imperial units. Settings shows it in
          feet and inches.
        </AppText>
      ) : null}
      <NumberField
        label="Starting weight (optional)"
        value={weight}
        onChange={(v) => {
          setWeight(v);
          setWeightError(null);
        }}
        min={20}
        max={400}
        unit={units === 'imperial' ? 'lb' : 'kg'}
        error={weightError}
      />
      <AppText variant="caption" muted>
        Weight is only used to estimate workout calories. You can change or remove it later in
        Settings.
      </AppText>
      <View style={{ marginTop: theme.spacing.sm, gap: theme.spacing.sm }}>
        <Button label="Continue" onPress={() => void save()} loading={busy} />
        <Button label="Back" variant="ghost" onPress={onBack} />
      </View>
    </Card>
  );
}

function StartDateStep({
  onBack,
  onError,
}: {
  onBack(): void;
  onError(message: string): void;
}): React.JSX.Element {
  const theme = useTheme();
  const [startDate, setStartDate] = useState<LocalDate>(todayLocal());
  const [busy, setBusy] = useState(false);

  const finish = async (): Promise<void> => {
    setBusy(true);
    try {
      if (!isValidLocalDate(startDate)) {
        throw new AppError('VALIDATION', 'Pick a valid Day 1 date.');
      }
      await createFirstJourney(startDate);
      await completeOnboarding();
      router.replace(ROUTES.today);
    } catch (e) {
      onError(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <AppText variant="heading" style={{ marginBottom: 0 }}>
        Choose your Day 1
      </AppText>
      <DateField label="Day 1 start date" value={startDate} onChange={setStartDate} maxDate={todayLocal()} />
      <AppText variant="caption" muted>
        {START_DATE_NOTE}
      </AppText>
      <View style={{ marginTop: theme.spacing.sm, gap: theme.spacing.sm }}>
        <Button label="Start tracking" onPress={() => void finish()} loading={busy} />
        <Button label="Back" variant="ghost" onPress={onBack} />
      </View>
    </Card>
  );
}

export function OnboardingScreen(): React.JSX.Element {
  // `chosen` is null until the user commits a step; before that the step is derived from storage.
  const [chosen, setChosen] = useState<Step | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<Profile> => getProfile(), []);
  const { data: profile, loading } = useFocusLoad(load, []);

  const go = (next: Step): void => {
    setError(null);
    setChosen(next);
  };

  const fail = (message: string): void => {
    setError(message);
  };

  if (loading || profile === null) {
    return (
      <Screen scroll={false}>
        <LoadingView />
      </Screen>
    );
  }

  const step: Step = chosen ?? firstIncompleteOnboardingStep(profile);

  return (
    <Screen>
      <AppText variant="title">Welcome</AppText>
      <ErrorBanner error={error} />

      {step === 'disclaimer' ? (
        <DisclaimerStep
          key="disclaimer"
          alreadyAcknowledged={profile.disclaimerAcknowledgedAt !== null}
          onDone={() => go('profile')}
          onError={fail}
        />
      ) : null}

      {step === 'profile' ? (
        <ProfileStep
          key={`profile:${profile.heightCm ?? 0}:${profile.unitSystem}:${profile.baselineWeightKg ?? 0}`}
          profile={profile}
          onDone={() => go('startDate')}
          onBack={() => go('disclaimer')}
          onError={fail}
        />
      ) : null}

      {step === 'startDate' ? <StartDateStep onBack={() => go('profile')} onError={fail} /> : null}
    </Screen>
  );
}
