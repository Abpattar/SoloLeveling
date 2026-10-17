/**
 * INTEGRATION CONTRACT: CMP-SHELL-003 (section 1 of 9)
 * Purpose: profile and units. Height, unit system and the optional baseline weight. Everything is
 *          stored canonically (cm, kg); conversion happens only for display.
 * Canonical definition: SHARED_CONTRACT.md §5, SHARED_SYMBOL_REGISTRY.md (CMP-SHELL-003)
 * Consumers: src/shell/SettingsScreen.tsx
 * Contract status: APPROVED
 */
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
// CONTRACT: API-SET-001/002 (A1) - the profile row and its validation
import { getProfile, updateProfile } from '@/shared/data/profileRepository';
// CONTRACT: API-UNIT-001..008 (A1) - the only place units are converted
import { cmToIn, inToCm, kgToLb, lbToKg } from '@/shared/utils/units';
// CONTRACT: API-CORE-002 (A1) - readable failure messages
import { toAppError } from '@/shared/errors/AppError';
// CONTRACT: CMP-UI-002..006/014 (A1) - form controls
import { Card } from '@/shared/ui/Card';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { NumberField } from '@/shared/ui/fields';
import { Segmented } from '@/shared/ui/Chip';
import { ErrorBanner } from '@/shared/ui/feedback';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import type { Profile, UnitSystem } from '@/shared/types/profile';

const HEIGHT_ERROR = 'Enter a height between 50 cm and 260 cm.';
const WEIGHT_ERROR = 'Enter a weight between 20 kg and 400 kg.';

function toFeetAndInches(heightCm: number): { feet: number; inches: number } {
  const totalInches = cmToIn(heightCm);
  const feet = Math.floor(totalInches / 12);
  return { feet, inches: Math.round(totalInches - feet * 12) };
}

/**
 * The editable form. Its `key` carries the loaded profile, so a save (or a restore) remounts it with
 * fresh values instead of syncing state from an effect.
 */
function ProfileForm({ profile }: { profile: Profile }): React.JSX.Element {
  const [units, setUnits] = useState<UnitSystem>(profile.unitSystem);
  const [heightCm, setHeightCm] = useState<number | null>(profile.heightCm);
  const [weight, setWeight] = useState<number | null>(
    profile.baselineWeightKg === null
      ? null
      : Number(
          (profile.unitSystem === 'imperial'
            ? kgToLb(profile.baselineWeightKg)
            : profile.baselineWeightKg
          ).toFixed(1),
        ),
  );
  const [feet, setFeet] = useState<number | null>(
    profile.heightCm === null ? null : toFeetAndInches(profile.heightCm).feet,
  );
  const [inches, setInches] = useState<number | null>(
    profile.heightCm === null ? null : toFeetAndInches(profile.heightCm).inches,
  );
  const [heightError, setHeightError] = useState<string | null>(null);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Switching units converts what is already entered, so nothing is silently discarded. */
  const changeUnits = (next: UnitSystem): void => {
    if (next === units) {
      return;
    }
    if (next === 'imperial') {
      if (heightCm !== null) {
        const split = toFeetAndInches(heightCm);
        setFeet(split.feet);
        setInches(split.inches);
      }
      setWeight(weight === null ? null : Number(kgToLb(weight).toFixed(1)));
    } else {
      const totalInches = (feet ?? 0) * 12 + (inches ?? 0);
      setHeightCm(totalInches > 0 ? Number(inToCm(totalInches).toFixed(1)) : null);
      setFeet(null);
      setInches(null);
      setWeight(weight === null ? null : Number(lbToKg(weight).toFixed(1)));
    }
    setUnits(next);
  };

  const currentHeightCm = (): number | null => {
    if (units === 'metric') {
      return heightCm;
    }
    const totalInches = (feet ?? 0) * 12 + (inches ?? 0);
    return totalInches > 0 ? Number(inToCm(totalInches).toFixed(1)) : null;
  };

  const save = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setHeightError(null);
    setWeightError(null);
    try {
      const nextHeight = currentHeightCm();
      const nextWeight = units === 'imperial' && weight !== null ? lbToKg(weight) : weight;

      if (nextHeight !== null && (nextHeight < 50 || nextHeight > 260)) {
        setHeightError(HEIGHT_ERROR);
        return;
      }
      if (nextWeight !== null && (nextWeight < 20 || nextWeight > 400)) {
        setWeightError(WEIGHT_ERROR);
        return;
      }

      await updateProfile({
        heightCm: nextHeight,
        unitSystem: units,
        baselineWeightKg: nextWeight === null ? null : Number(nextWeight.toFixed(2)),
      });
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ErrorBanner error={error} />
      <AppText variant="label" muted>
        Units
      </AppText>
      <Segmented<UnitSystem>
        options={[
          { value: 'metric', label: 'Metric (cm, kg)' },
          { value: 'imperial', label: 'Imperial (ft, lb)' },
        ]}
        value={units}
        onChange={changeUnits}
      />
      <View style={{ height: 8 }} />

      {units === 'metric' ? (
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
      ) : (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <NumberField
              label="Height (feet)"
              value={feet}
              onChange={(v) => {
                setFeet(v);
                setHeightError(null);
              }}
              min={1}
              max={8}
              integer
              unit="ft"
              error={heightError}
            />
          </View>
          <View style={{ flex: 1 }}>
            <NumberField
              label="Height (inches)"
              value={inches}
              onChange={(v) => {
                setInches(v);
                setHeightError(null);
              }}
              min={0}
              max={11}
              integer
              unit="in"
            />
          </View>
        </View>
      )}

      <NumberField
        label="Baseline weight (optional)"
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
        Used only to estimate workout calories. The app never picks a target for you.
      </AppText>

      <View style={{ marginTop: 8 }}>
        <Button label="Save profile" onPress={() => void save()} loading={busy} />
      </View>
    </>
  );
}

export function ProfileSection(): React.JSX.Element {
  const load = useCallback(async (): Promise<Profile> => getProfile(), []);
  const { data } = useFocusLoad(load, []);

  return (
    <Card>
      <AppText variant="heading" style={{ marginBottom: 0 }}>
        Profile &amp; units
      </AppText>
      {data === null ? null : (
        <ProfileForm
          key={`${data.heightCm ?? 0}:${data.unitSystem}:${data.baselineWeightKg ?? 0}`}
          profile={data}
        />
      )}
    </Card>
  );
}
