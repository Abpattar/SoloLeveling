/**
 * INTEGRATION CONTRACT: CMP-PHOTO-002
 * Purpose: capture a progress photo. After saving it says exactly when the photo will appear, so the
 *          wait is never a surprise. Skipping at any point changes nothing.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-PHOTO-002), SHARED_CONTRACT §10
 * Consumers: src/app/photos/capture.tsx (A7)
 * Contract status: APPROVED
 */
import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { router } from 'expo-router';
// API-PHOTO-006 + API-PHOTO-014 (A5 self)
import { addProgressPhoto, getMilestoneUnlockDate } from '@/modules/photos';
// HOOK-PHOTO-001 (A5 self)
import { useActiveJourney } from '@/modules/photos/hooks/useActiveJourney';
// CONTRACT: CMP-UI-015 (A1) — the only camera surface
import { PhotoCapture } from '@/shared/ui/PhotoCapture';
// CONTRACT: CONST-NAV-001 (A1) — route builders
import { ROUTES } from '@/shared/navigation/routes';
import { Screen } from '@/shared/ui/Screen';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Chip } from '@/shared/ui/Chip';
import { ErrorBanner } from '@/shared/ui/feedback';
import { useTheme } from '@/shared/ui/theme';
import { toAppError } from '@/shared/errors/AppError';
import { formatDisplayDate, todayLocal } from '@/shared/utils/dates';
import type { ProgressPhotoCategory } from '@/shared/types/photos';

export interface ProgressPhotoCaptureScreenProps {
  sessionId: string | null;
}

const CATEGORIES: ProgressPhotoCategory[] = ['front', 'side', 'back', 'other'];

export function ProgressPhotoCaptureScreen({
  sessionId,
}: ProgressPhotoCaptureScreenProps): React.JSX.Element {
  const theme = useTheme();
  const { journey } = useActiveJourney();
  const [tempUri, setTempUri] = useState<string | null>(null);
  const [category, setCategory] = useState<ProgressPhotoCategory | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  if (tempUri === null && savedMessage === null) {
    return (
      <PhotoCapture
        title="Take a progress photo"
        onCaptured={(uri) => setTempUri(uri)}
        onCancel={() => router.back()}
      />
    );
  }

  const save = async (): Promise<void> => {
    if (!tempUri) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await addProgressPhoto({ tempImageUri: tempUri, sessionId: sessionId ?? undefined, category: category ?? undefined });
      const milestone = created.unlockMilestone;
      if (milestone === null) {
        setSavedMessage('Saved. This photo is visible straight away.');
      } else if (journey) {
        setSavedMessage(
          `Saved. Hidden until Day ${milestone} (${formatDisplayDate(
            getMilestoneUnlockDate(journey.startDate, milestone),
          )}).`,
        );
      } else {
        setSavedMessage(`Saved. Hidden until Day ${milestone}.`);
      }
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppText variant="title">Progress photo</AppText>
      <ErrorBanner error={error} />

      {savedMessage ? (
        <Card>
          <AppText>{savedMessage}</AppText>
          <Button label="Done" onPress={() => router.replace(ROUTES.photos)} />
        </Card>
      ) : (
        <>
          {tempUri ? (
            <Image
              source={{ uri: tempUri }}
              style={{ width: '100%', height: 260, borderRadius: theme.radius.md }}
              accessibilityLabel="Progress photo you just took"
            />
          ) : null}

          <AppText variant="label" muted>
            Angle (optional)
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {CATEGORIES.map((value) => (
              <Chip
                key={value}
                label={value}
                selected={category === value}
                onPress={() => setCategory(category === value ? null : value)}
              />
            ))}
          </View>

          <AppText variant="caption" muted>
            It will be hidden until its milestone day. You can still delete it at any time.
          </AppText>

          <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
            <Button label="Save photo" onPress={() => void save()} loading={busy} />
            <Button label="Retake" variant="secondary" onPress={() => setTempUri(null)} disabled={busy} />
            <Button label="Skip" variant="ghost" onPress={() => router.back()} disabled={busy} />
          </View>
          <AppText variant="caption" muted>
            {`Today is ${formatDisplayDate(todayLocal())}.`}
          </AppText>
        </>
      )}
    </Screen>
  );
}