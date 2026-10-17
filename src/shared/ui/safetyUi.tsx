/**
 * INTEGRATION CONTRACT: CMP-SAFE-001, CMP-SAFE-002
 * Purpose: the symptom checklist and the stop-and-contact advice card. The wording comes only from
 *          `CONST-TEXT-002/003`, so the app can never soften or invent clinical advice.
 * Canonical definition: ERROR_HANDLING_AND_SECURITY.md SAF-03, GLOBAL_ACCEPTANCE_TESTS GAT-009
 * Consumers: training (A2), journal (A6)
 * Contract status: APPROVED
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Button } from './Button';
import { Segmented } from './Chip';
import { useTheme } from './theme';
import { SYMPTOM_FLAG_LABELS } from '../constants/text';
import type { SafetyAdvice, SymptomFlag, SymptomReport } from '../types/safety';

const FLAG_ORDER: SymptomFlag[] = [
  'sharp_or_increasing_pain',
  'new_swelling',
  'giving_way',
  'locking_or_catching',
  'numbness_or_tingling',
  'other_new_symptom',
];

const PAIN_OPTIONS = [
  { value: 'none', label: 'Not given' },
  { value: 'mild', label: '0-3' },
  { value: 'medium', label: '4-6' },
  { value: 'high', label: '7-10' },
] as const;

function painBandToScore(band: string, current: number | null): number | null {
  switch (band) {
    case 'none':
      return null;
    case 'mild':
      return current !== null && current <= 3 ? current : 1;
    case 'medium':
      return current !== null && current >= 4 && current <= 6 ? current : 5;
    case 'high':
      return current !== null && current >= 7 ? current : 8;
    default:
      return current;
  }
}

function scoreToBand(score: number | null): string {
  if (score === null) {
    return 'none';
  }
  if (score <= 3) {
    return 'mild';
  }
  if (score <= 6) {
    return 'medium';
  }
  return 'high';
}

export interface SymptomChecklistProps {
  value: SymptomReport;
  onChange(next: SymptomReport): void;
}

/** CMP-SAFE-001 */
export function SymptomChecklist({ value, onChange }: SymptomChecklistProps): React.JSX.Element {
  const theme = useTheme();

  const toggle = (flag: SymptomFlag): void => {
    const flags = value.flags.includes(flag)
      ? value.flags.filter((f) => f !== flag)
      : [...value.flags, flag];
    onChange({ flags, painScore: value.painScore });
  };

  const setPain = (band: string): void => {
    onChange({ flags: value.flags, painScore: painBandToScore(band, value.painScore) });
  };

  return (
    <View style={{ marginBottom: theme.spacing.md }}>
      <AppText variant="label" muted>
        Symptoms (tick anything that is new or getting worse)
      </AppText>
      {FLAG_ORDER.map((flag) => {
        const selected = value.flags.includes(flag);
        return (
          <Pressable
            key={flag}
            accessibilityRole="checkbox"
            accessibilityLabel={SYMPTOM_FLAG_LABELS[flag]}
            accessibilityState={{ checked: selected }}
            onPress={() => toggle(flag)}
            style={[
              styles.row,
              {
                minHeight: 44,
                justifyContent: 'center',
                borderRadius: theme.radius.sm,
                paddingHorizontal: theme.spacing.sm,
                marginBottom: 4,
                backgroundColor: selected ? theme.colors.surface : 'transparent',
                borderWidth: 1,
                borderColor: selected ? theme.colors.primary : theme.colors.border,
              },
            ]}
          >
            <AppText>{SYMPTOM_FLAG_LABELS[flag]}</AppText>
          </Pressable>
        );
      })}

      <AppText variant="label" muted style={{ marginTop: theme.spacing.sm }}>
        Pain right now (optional)
      </AppText>
      <Segmented
        options={PAIN_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        value={scoreToBand(value.painScore)}
        onChange={setPain}
      />
      {value.painScore !== null ? (
        <View style={{ marginTop: theme.spacing.sm, flexDirection: 'row', alignItems: 'center' }}>
          <AppText muted style={{ flex: 1 }}>
            {value.painScore}/10
          </AppText>
          <Button label="Change" variant="ghost" onPress={() => onChange({ flags: value.flags, painScore: null })} />
        </View>
      ) : null}
    </View>
  );
}

export interface SafetyAdviceCardProps {
  advice: SafetyAdvice;
}

/** CMP-SAFE-002 */
export function SafetyAdviceCard({ advice }: SafetyAdviceCardProps): React.JSX.Element {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.warning,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
          marginBottom: theme.spacing.md,
        },
      ]}
    >
      <AppText variant="heading" style={{ color: theme.colors.warning }}>
        {advice.title}
      </AppText>
      <AppText>{advice.message}</AppText>
      {advice.reasons.length > 0 ? (
        <View style={{ marginTop: theme.spacing.sm }}>
          {advice.reasons.map((reason) => (
            <AppText key={reason} variant="caption" muted>
              • {reason}
            </AppText>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderWidth: 1 },
  card: { borderWidth: 2 },
});