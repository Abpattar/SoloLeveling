/**
 * INTEGRATION CONTRACT: CMP-BODY-001
 * Purpose: measurements with a simple weight chart, the change from baseline and weekly/monthly
 *          averages. It shows what was recorded and stops there: no change is ever described as
 *          recovery, progress or a health outcome (SAF-07).
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-BODY-001), REQ-MEAS-001..004
 * Consumers: src/app/measurements.tsx (A7)
 * Contract status: APPROVED
 */
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
// CONTRACT: API-BODY-004/005 + trend maths (A6 self)
import {
  changeFromBaseline,
  deleteMeasurement,
  getWeightSeriesKg,
  listMeasurements,
  monthlyAverages,
  movingAverage,
  updateMeasurement,
  weeklyAverages,
  addMeasurement,
} from '@/modules/body';
import { MeasurementForm } from '../components/MeasurementForm';
// CONTRACT: LOCAL-WORKAROUND (A6) - dependency-free SVG line chart, shared UI
import { LineChart } from '@/shared/ui/charts/LineChart';
// CONTRACT: API-SET-001 (A1) — profile units and baseline
import { getProfile } from '@/shared/data/profileRepository';
// CONTRACT: API-UNIT-006/007 (A1) — formatting
import { formatLength, formatWeight, weightUnitLabel } from '@/shared/utils/units';
// CONTRACT: API-UI-001 (A1) — confirmation before deleting
import { confirmAction } from '@/shared/ui/confirmAction';
import { Screen } from '@/shared/ui/Screen';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Segmented } from '@/shared/ui/Chip';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/ui/feedback';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { useTheme } from '@/shared/ui/theme';
import { formatDisplayDate, todayLocal } from '@/shared/utils/dates';
import { toAppError } from '@/shared/errors/AppError';
import type { Measurement, MeasurementInput, MeasurementType, WeightPoint } from '@/shared/types/body';
import type { Profile } from '@/shared/types/profile';

interface MeasurementsData {
  profile: Profile;
  measurements: Measurement[];
  weightSeries: WeightPoint[];
}

export function MeasurementsScreen(): React.JSX.Element {
  const theme = useTheme();
  const [filter, setFilter] = useState<MeasurementType | 'all'>('all');
  const [editing, setEditing] = useState<Measurement | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<MeasurementsData> => {
    const [profile, measurements, weightSeries] = await Promise.all([
      getProfile(),
      listMeasurements(),
      getWeightSeriesKg(),
    ]);
    return { profile, measurements, weightSeries };
  }, []);

  const { data, loading, error, reload } = useFocusLoad(load, []);

  const newestFirst = [...(data?.measurements ?? [])].reverse();
  const shown =
    filter === 'all' ? newestFirst : newestFirst.filter((m) => m.type === filter);

  const save = async (input: MeasurementInput): Promise<void> => {
    setSaving(true);
    setActionError(null);
    try {
      if (editing) {
        await updateMeasurement(editing.id, input);
      } else {
        await addMeasurement(input);
      }
      setEditing(null);
      reload();
    } catch (e) {
      setActionError(toAppError(e).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (measurement: Measurement): Promise<void> => {
    const ok = await confirmAction({
      title: 'Delete this measurement?',
      message: 'It is removed permanently.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    setActionError(null);
    try {
      await deleteMeasurement(measurement.id);
      reload();
    } catch (e) {
      setActionError(toAppError(e).message);
    }
  };

  const weightUnit = weightUnitLabel(data?.profile.unitSystem ?? 'metric');
  const change = changeFromBaseline(data?.weightSeries ?? [], data?.profile.baselineWeightKg ?? null);
  const weekly = weeklyAverages(data?.weightSeries ?? []);
  const monthly = monthlyAverages(data?.weightSeries ?? []);
  const average = movingAverage(data?.weightSeries ?? [], 7);

  return (
    <Screen>
      <AppText variant="title">Measurements</AppText>
      <AppText muted>
        {data
          ? `Height ${data.profile.heightCm !== null ? formatLength(data.profile.heightCm, data.profile.unitSystem) : 'not set'} · units ${data.profile.unitSystem}`
          : ''}
      </AppText>
      <AppText variant="caption" muted>
        Height and units are edited in Settings. Measurements and photos do not prove muscle recovery.
      </AppText>

      <ErrorBanner error={error ?? actionError} />
      {loading && !data ? <LoadingView /> : null}

      <MeasurementForm
        measurement={editing}
        unitSystem={data?.profile.unitSystem ?? 'metric'}
        onSave={(input) => void save(input)}
        onCancel={() => setEditing(null)}
        saving={saving}
        errorMessage={actionError}
      />

      <Segmented
        options={[
          { value: 'all', label: 'All' },
          { value: 'weight', label: 'Weight' },
          { value: 'waist', label: 'Waist' },
          { value: 'thigh', label: 'Thigh' },
          { value: 'custom', label: 'Other' },
        ]}
        value={filter}
        onChange={(value) => setFilter(value as MeasurementType | 'all')}
      />

      {shown.length === 0 ? (
        <EmptyState title="Nothing recorded yet" message="Add a weight or another measurement above." />
      ) : null}

      {shown.map((measurement) => (
        <Card key={measurement.id}>
          <AppText variant="heading" style={{ marginBottom: 0 }}>
            {measurement.type === 'custom' && measurement.customLabel
              ? measurement.customLabel
              : measurement.type}
          </AppText>
          <AppText variant="caption" muted>
            {measurement.type === 'weight'
              ? formatWeight(measurement.value, data?.profile.unitSystem ?? 'metric')
              : `${measurement.value} ${measurement.unit}`}
            {' · '}
            {formatDisplayDate(measurement.localDate)}
          </AppText>
          {measurement.note ? (
            <AppText variant="caption" muted>
              {measurement.note}
            </AppText>
          ) : null}
          <View style={{ gap: theme.spacing.xs }}>
            <Button label="Edit" variant="secondary" onPress={() => setEditing(measurement)} />
            <Button
              label="Delete"
              variant="danger"
              onPress={() => void remove(measurement)}
            />
          </View>
        </Card>
      ))}

      <Card>
        <LineChart
          title={`Weight (${weightUnit})`}
          points={(data?.weightSeries ?? []).map((point) => ({
            label: formatDisplayDate(point.localDate),
            value: point.valueKg,
          }))}
          averagePoints={average.map((point) => ({
            label: formatDisplayDate(point.localDate),
            value: point.valueKg,
          }))}
          unit={weightUnit === 'lb' ? 'lb' : 'kg'}
        />
        <AppText variant="caption" muted>
          The dashed line is the 7-day average. Day-to-day changes are normal; look at the trend.
        </AppText>
      </Card>

      <Card>
        <AppText variant="heading" style={{ marginBottom: 0 }}>
          Change from baseline
        </AppText>
        <AppText variant="caption" muted>
          {change === null
            ? 'Nothing to compare yet.'
            : `${change > 0 ? '+' : ''}${change.toFixed(1)} kg since ${
                data?.profile.baselineWeightKg !== null && data?.profile.baselineWeightKg !== undefined
                  ? 'your starting weight'
                  : 'your first entry'
              }.`}
        </AppText>
      </Card>

      <Card>
        <AppText variant="heading" style={{ marginBottom: 0 }}>
          Weekly averages
        </AppText>
        {weekly.length === 0 ? (
          <AppText variant="caption" muted>
            No data yet.
          </AppText>
        ) : (
          weekly.map((week) => (
            <AppText key={week.key} variant="caption" muted>
              {`${week.key}: ${week.averageKg.toFixed(1)} kg (${week.count} entries)`}
            </AppText>
          ))
        )}
      </Card>

      <Card>
        <AppText variant="heading" style={{ marginBottom: 0 }}>
          Monthly averages
        </AppText>
        {monthly.length === 0 ? (
          <AppText variant="caption" muted>
            No data yet.
          </AppText>
        ) : (
          monthly.map((month) => (
            <AppText key={month.key} variant="caption" muted>
              {`${month.key}: ${month.averageKg.toFixed(1)} kg (${month.count} entries)`}
            </AppText>
          ))
        )}
      </Card>

      <AppText variant="caption" muted>
        {`Today is ${formatDisplayDate(todayLocal())}.`}
      </AppText>
    </Screen>
  );
}