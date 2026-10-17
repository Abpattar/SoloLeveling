/**
 * INTEGRATION CONTRACT: CMP-FOOD-004
 * Purpose: manage the meal list. The four built-in meals can be renamed but never archived; custom
 *          meals can be added, renamed, archived and reordered.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-FOOD-004), REQ-FOOD-001, GAT-048
 * Consumers: src/app/food/categories.tsx (A7)
 * Contract status: APPROVED
 */
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
// CONTRACT: API-FOOD-001..005 (A3 self)
import {
  archiveMealCategory,
  createMealCategory,
  listMealCategories,
  renameMealCategory,
  reorderMealCategories,
} from '@/modules/food';
// CONTRACT: API-UI-001 (A1) — destructive confirmation
import { confirmAction } from '@/shared/ui/confirmAction';
import { Screen } from '@/shared/ui/Screen';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { TextField } from '@/shared/ui/fields';
import { ErrorBanner, LoadingView } from '@/shared/ui/feedback';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { useTheme } from '@/shared/ui/theme';
import { toAppError } from '@/shared/errors/AppError';
import type { MealCategory } from '@/shared/types/food';

export function MealCategoriesScreen(): React.JSX.Element {
  const theme = useTheme();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<MealCategory[]> => listMealCategories(), []);
  const { data, loading, error, reload } = useFocusLoad(load, []);

  const run = async (action: () => Promise<unknown>): Promise<void> => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      reload();
    } catch (e) {
      setActionError(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const move = (index: number, direction: -1 | 1): void => {
    const ids = (data ?? []).map((c) => c.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) {
      return;
    }
    const swapped = [...ids];
    const tmp = swapped[index] as string;
    swapped[index] = swapped[target] as string;
    swapped[target] = tmp;
    void run(() => reorderMealCategories(swapped));
  };

  return (
    <Screen>
      <AppText variant="title">Meals</AppText>
      <AppText muted>
        Breakfast, lunch, dinner and snacks are built in. You can add your own — for example
        &ldquo;evening snack&rdquo;. Archived meals keep working for photos you already logged.
      </AppText>

      <ErrorBanner error={error} />
      <ErrorBanner error={actionError} />
      {loading && !data ? <LoadingView /> : null}

      <Card>
        <TextField label="New meal" value={newName} onChangeText={setNewName} />
        <Button
          label="Add meal"
          onPress={() =>
            void run(async () => {
              await createMealCategory(newName);
              setNewName('');
            })
          }
          loading={busy}
        />
      </Card>

      {(data ?? []).map((category, index) => (
        <Card key={category.id}>
          <AppText variant="heading" style={{ marginBottom: 0 }}>
            {category.name}
          </AppText>
          <AppText variant="caption" muted>
            {category.isDefault ? 'Built-in meal' : 'Your own meal'}
          </AppText>

          {editingId === category.id ? (
            <>
              <TextField label="New name" value={editName} onChangeText={setEditName} />
              <Button
                label="Save name"
                onPress={() =>
                  void run(async () => {
                    await renameMealCategory(category.id, editName);
                    setEditingId(null);
                  })
                }
                loading={busy}
              />
              <Button label="Cancel" variant="ghost" onPress={() => setEditingId(null)} disabled={busy} />
            </>
          ) : (
            <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
              <Button
                label="Rename"
                variant="secondary"
                onPress={() => {
                  setEditingId(category.id);
                  setEditName(category.name);
                }}
                disabled={busy}
              />
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button label="Move up" variant="ghost" onPress={() => move(index, -1)} disabled={busy || index === 0} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Move down"
                    variant="ghost"
                    onPress={() => move(index, 1)}
                    disabled={busy || index === (data ?? []).length - 1}
                  />
                </View>
              </View>
              {!category.isDefault ? (
                <Button
                  label="Archive"
                  variant="danger"
                  onPress={() =>
                    void (async () => {
                      const ok = await confirmAction({
                        title: `Archive "${category.name}"?`,
                        message:
                          'It disappears from the list you pick from. Meals you already logged keep working.',
                        confirmLabel: 'Archive',
                        destructive: true,
                      });
                      if (ok) {
                        await run(() => archiveMealCategory(category.id));
                      }
                    })()
                  }
                  disabled={busy}
                />
              ) : null}
            </View>
          )}
        </Card>
      ))}

      <Button label="Done" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}