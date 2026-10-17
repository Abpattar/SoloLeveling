/**
 * INTEGRATION CONTRACT: API-UI-001
 * Purpose: promise wrapper around `Alert.alert` so destructive actions (delete, early unlock,
 *          restore) always ask first and always return a boolean.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (API-UI-001)
 * Consumers: A2, A3, A4, A5, A6, A7
 * Contract status: APPROVED
 */
import { Alert } from 'react-native';

export interface ConfirmActionOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
}

/** API-UI-001 */
export function confirmAction(options: ConfirmActionOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      options.title,
      options.message,
      [
        {
          text: options.cancelLabel ?? 'Cancel',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: options.confirmLabel,
          style: options.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}