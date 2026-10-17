/**
 * INTEGRATION CONTRACT: CMP-UI-015
 * Purpose: the only camera surface in the app (the only file importing `expo-camera`). It handles
 *          permission states, captures WITHOUT EXIF, never writes to the media library, and hands a
 *          temporary file URI to the caller, which must copy it into private storage.
 * Canonical definition: ERROR_HANDLING_AND_SECURITY.md SEC-10, GLOBAL_ACCEPTANCE_TESTS GAT-027
 * Consumers: food (A3), photos (A5)
 * Contract status: APPROVED
 */
import React, { useCallback, useRef, useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import type { CameraType } from 'expo-camera/build/Camera.types';
import { AppText } from './AppText';
import { Button } from './Button';
import { EmptyState, ErrorBanner } from './feedback';
import { useTheme } from './theme';

export interface PhotoCaptureProps {
  facing?: 'front' | 'back';
  title?: string;
  onCaptured(tempUri: string): void;
  onCancel(): void;
}

/** CMP-UI-015 */
export function PhotoCapture({
  facing = 'back',
  title = 'Take a photo',
  onCaptured,
  onCancel,
}: PhotoCaptureProps): React.JSX.Element {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [cameraType, setCameraType] = useState<CameraType>(facing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback(async () => {
    if (!cameraRef.current || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        exif: false,
        skipProcessing: false,
        base64: false,
      });
      if (picture?.uri) {
        onCaptured(picture.uri);
      } else {
        setError('The photo could not be taken. Please try again.');
      }
    } catch {
      // Never surface a native camera stack trace; the camera stays usable after a failure.
      setError('The photo could not be taken. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [busy, onCaptured]);

  if (!permission) {
    return <View style={[styles.full, { backgroundColor: theme.colors.background }]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.full, { backgroundColor: theme.colors.background }]}>
        <View style={{ padding: theme.spacing.md }}>
          <AppText variant="heading">{title}</AppText>
          {permission.canAskAgain ? (
            <EmptyState
              title="Camera access is needed"
              message="The app only uses the camera to photograph your meals and progress. Photos stay on this phone unless you turn on external analysis, which is off by default."
              action={{ label: 'Allow camera', onPress: () => void requestPermission() }}
            />
          ) : (
            <EmptyState
              title="Camera access is turned off"
              message="Turn on camera access for this app in Android Settings, then come back."
              action={{ label: 'Open settings', onPress: () => void Linking.openSettings() }}
            />
          )}
          <Button label="Cancel" variant="ghost" onPress={onCancel} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.full, { backgroundColor: '#000000' }]}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={cameraType} />
      <View style={styles.overlay}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={onCancel}
            style={styles.topButton}
          >
            <AppText style={{ color: '#FFFFFF' }}>Cancel</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Flip camera"
            onPress={() => setCameraType(cameraType === 'back' ? 'front' : 'back')}
            style={styles.topButton}
          >
            <AppText style={{ color: '#FFFFFF' }}>Flip</AppText>
          </Pressable>
        </View>
        <View style={{ padding: theme.spacing.md }}>
          <ErrorBanner error={error} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => void capture()}
            style={[styles.shutter, { borderColor: '#FFFFFF' }]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  topButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
});