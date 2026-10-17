/**
 * INTEGRATION CONTRACT: internal component (A5 photos)
 * Purpose: one milestone row. A locked milestone shows only the unlock date and how many photos are
 *          hidden — never a thumbnail, a path or a file name (SEC-08).
 * Canonical definition: AGENT_05_PROMPT.md §3
 * Consumers: PhotosHomeScreen.tsx
 * Contract status: APPROVED (internal symbol, no registry ID)
 */
import React from 'react';
import { View } from 'react-native';
import { Button } from '@/shared/ui/Button';
import { AppText } from '@/shared/ui/AppText';
import { Card } from '@/shared/ui/Card';
import { useTheme } from '@/shared/ui/theme';
import { formatDisplayDate } from '@/shared/utils/dates';
import type { MilestoneState } from '@/shared/types/photos';

export interface MilestoneCardProps {
  state: MilestoneState;
  onUnlockEarly(): void;
  onViewComparison(): void;
  busy: boolean;
}

export function MilestoneCard({
  state,
  onUnlockEarly,
  onViewComparison,
  busy,
}: MilestoneCardProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AppText variant="heading" style={{ flex: 1, marginBottom: 0 }}>
          {`Day ${state.day}`}
        </AppText>
        <AppText
          variant="caption"
          style={{
            marginBottom: 0,
            color: state.unlocked ? theme.colors.success : theme.colors.textMuted,
          }}
        >
          {state.unlocked ? 'Unlocked' : 'Locked'}
        </AppText>
      </View>

      {state.unlocked ? (
        <>
          {state.unlockedEarly ? (
            <AppText variant="caption" muted>
              Unlocked early.
            </AppText>
          ) : (
            <AppText variant="caption" muted>
              {`Unlocked on ${formatDisplayDate(state.unlockDate)}`}
            </AppText>
          )}
          <Button label="View comparison" variant="secondary" onPress={onViewComparison} disabled={busy} />
        </>
      ) : (
        <>
          <AppText variant="caption" muted>
            {`Unlocks ${formatDisplayDate(state.unlockDate)} (Day ${state.day})`}
          </AppText>
          <AppText variant="caption" muted>
            {`${state.lockedPhotoCount} photo${state.lockedPhotoCount === 1 ? '' : 's'} hidden until then`}
          </AppText>
          {state.isNextPending ? (
            <Button label="Unlock early" variant="ghost" onPress={onUnlockEarly} disabled={busy} />
          ) : null}
        </>
      )}
    </Card>
  );
}