/**
 * INTEGRATION CONTRACT: CMP-REM-001
 * Purpose: the reminder settings block. Permission is requested only when the user actually turns
 *          something on — never at launch — and a denial leaves every toggle off with an explanation
 *          and a way to open Android settings.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-REM-001), SHARED_CONTRACT §9
 * Consumers: src/shell/SettingsScreen.tsx (A7)
 * Contract status: APPROVED
 */
import React, { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';
// CONTRACT: HOOK-SET-001 (A1) — settings read/write
import { useSettings } from '@/shared/settings/SettingsProvider';
// CONTRACT: CONST-SET-002 (A1) — default meal reminder times
import { DEFAULT_MEAL_REMINDER_TIMES } from '@/shared/constants/settings';
// CONST-TEXT-008 (A1) — the fixed battery-optimisation note
import { BATTERY_OPTIMISATION_NOTE } from '@/shared/constants/text';
// CONTRACT: API-FOOD-001 (A3) — meal categories
import { listMealCategories } from '@/modules/food';
import { getNotificationPermissionState, requestNotificationPermission, syncReminders } from './reminderService';
import { Card } from '@/shared/ui/Card';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { TimeField } from '@/shared/ui/fields';
import { ErrorBanner } from '@/shared/ui/feedback';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { useTheme } from '@/shared/ui/theme';
import { toAppError } from '@/shared/errors/AppError';
import type { MealReminderSetting } from '@/shared/types/settings';
import type { MealCategory } from '@/shared/types/food';
import type { NotificationPermissionState } from './types';

const FALLBACK_MEAL_TIME = '12:00';

export function ReminderSettingsSection(): React.JSX.Element {
  const theme = useTheme();
  const { settings, update } = useSettings();
  const [permission, setPermission] = useState<NotificationPermissionState>('undetermined');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [state, categories] = await Promise.all([
      getNotificationPermissionState(),
      listMealCategories(),
    ]);
    setPermission(state);
    return categories;
  }, []);

  const { data: categories } = useFocusLoad(load, []);

  const save = async (patch: Parameters<typeof update>[0]): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await update(patch);
      await syncReminders();
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const enableWithPermission = async (enable: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const state = permission === 'granted' ? 'granted' : await requestNotificationPermission();
      setPermission(state);
      if (state !== 'granted') {
        // The toggle stays off; the explanation below is already visible.
        return;
      }
      await enable();
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const setMeal = (meal: MealCategory, patch: Partial<MealReminderSetting>): Promise<void> => {
    const current = settings.reminders.meals[meal.id] ?? {
      enabled: false,
      timeLocal: DEFAULT_MEAL_REMINDER_TIMES[meal.id] ?? FALLBACK_MEAL_TIME,
    };
    return save({ reminders: { meals: { [meal.id]: { ...current, ...patch } } } });
  };

  const denied = permission === 'denied';

  return (
    <Card>
      <AppText variant="heading" style={{ marginBottom: 0 }}>
        Reminders
      </AppText>
      <ErrorBanner error={error} />

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.sm }}>
        <AppText style={{ flex: 1 }}>
          {settings.reminders.exercise.enabled ? 'Exercise reminder on' : 'Exercise reminder off'}
        </AppText>
        <Chip
          label={settings.reminders.exercise.enabled ? 'On' : 'Off'}
          selected={settings.reminders.exercise.enabled}
          onPress={() => {
            if (settings.reminders.exercise.enabled) {
              void save({
                reminders: { exercise: { ...settings.reminders.exercise, enabled: false } },
              });
            } else {
              void enableWithPermission(() =>
                save({
                  reminders: { exercise: { ...settings.reminders.exercise, enabled: true } },
                }),
              );
            }
          }}
        />
      </View>
      <TimeField
        label="Exercise reminder time"
        value={settings.reminders.exercise.timeLocal}
        onChange={(timeLocal) => void save({ reminders: { exercise: { ...settings.reminders.exercise, timeLocal } } })}
      />

      <AppText variant="label" muted>
        Meal photo prompts
      </AppText>
      {(categories ?? []).map((meal) => {
        const setting = settings.reminders.meals[meal.id] ?? {
          enabled: false,
          timeLocal: DEFAULT_MEAL_REMINDER_TIMES[meal.id] ?? FALLBACK_MEAL_TIME,
        };
        return (
          <View key={meal.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppText style={{ flex: 1 }}>{meal.name}</AppText>
              <Chip
                label={setting.enabled ? 'On' : 'Off'}
                selected={setting.enabled}
                onPress={() => {
                  if (setting.enabled) {
                    void setMeal(meal, { enabled: false });
                  } else {
                    void enableWithPermission(() => setMeal(meal, { enabled: true }));
                  }
                }}
              />
            </View>
            <TimeField
              label={`${meal.name} time`}
              value={setting.timeLocal}
              onChange={(timeLocal) => void setMeal(meal, { timeLocal })}
            />
          </View>
        );
      })}

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.sm }}>
        <AppText style={{ flex: 1 }}>
          {settings.reminders.endOfDay.enabled ? 'End-of-day summary on' : 'End-of-day summary off'}
        </AppText>
        <Chip
          label={settings.reminders.endOfDay.enabled ? 'On' : 'Off'}
          selected={settings.reminders.endOfDay.enabled}
          onPress={() => {
            if (settings.reminders.endOfDay.enabled) {
              void save({
                reminders: { endOfDay: { ...settings.reminders.endOfDay, enabled: false } },
              });
            } else {
              void enableWithPermission(() =>
                save({
                  reminders: { endOfDay: { ...settings.reminders.endOfDay, enabled: true } },
                }),
              );
            }
          }}
        />
      </View>
      <TimeField
        label="End-of-day time"
        value={settings.reminders.endOfDay.timeLocal}
        onChange={(timeLocal) => void save({ reminders: { endOfDay: { ...settings.reminders.endOfDay, timeLocal } } })}
      />

      {denied ? (
        <View>
          <AppText style={{ color: theme.colors.warning }}>
            Notifications are turned off for this app, so no reminders can be scheduled. Reminders
            stay off until you allow them.
          </AppText>
          <Button label="Open settings" variant="secondary" onPress={() => void Linking.openSettings()} />
        </View>
      ) : null}

      <AppText variant="caption" muted>
        {BATTERY_OPTIMISATION_NOTE}
      </AppText>
      {busy ? (
        <AppText variant="caption" muted>
          Saving�
        </AppText>
      ) : null}
    </Card>
  );
}