/**
 * INTEGRATION CONTRACT: CMP-AI-001
 * Purpose: the only place external analysis can be turned on. The order is deliberate and must not
 *          change: pick a provider → read what that provider does with your photos → paste a key →
 *          tick the consent box → Enable. Nothing is sent before all four steps are done.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-AI-001), SHARED_CONTRACT §7 (consent rules)
 * Consumers: src/shell/SettingsScreen.tsx (A7)
 * Contract status: APPROVED
 */
import React, { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';
// CONTRACT: HOOK-SET-001 (A1) — settings read/write
import { useSettings } from '@/shared/settings/SettingsProvider';
// CONTRACT: API-SEC-002/003 (A1) — the key lives only in secure storage
import { deleteSecret, setSecret } from '@/shared/platform/secureStorage';
// CONST-TEXT-004 (A1) — the fixed estimate disclaimer
import { ESTIMATE_DISCLAIMER_TEXT } from '@/shared/constants/text';
import { nowIso } from '@/shared/utils/dates';
import { toAppError } from '@/shared/errors/AppError';
import { getAnalysisAvailability } from './availability';
import { AI_PROVIDER_CATALOG, getProviderInfo } from './providers/catalog';
import { Card } from '@/shared/ui/Card';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Segmented } from '@/shared/ui/Chip';
import { TextField } from '@/shared/ui/fields';
import { ErrorBanner } from '@/shared/ui/feedback';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { useTheme } from '@/shared/ui/theme';
import type { AiProviderId } from '@/shared/types/settings';
import type { SecretKey } from '@/shared/platform/secureStorage';
import type { AnalysisAvailability } from '@/shared/types/nutritionAi';

type Availability = AnalysisAvailability | null;

export function AnalysisSettingsSection(): React.JSX.Element {
  const theme = useTheme();
  const { settings, update } = useSettings();
  const [availability] = useState<Availability>(null);
  const [pickedProvider, setPickedProvider] = useState<AiProviderId>('groq');
  const [apiKey, setApiKey] = useState('');
  const [modelOverride, setModelOverride] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (): Promise<AnalysisAvailability> => getAnalysisAvailability(), []);
  const { data } = useFocusLoad(load, []);
  const state: Availability = data ?? availability;

  const provider = getProviderInfo(settings.ai.providerId ?? pickedProvider);
  const isOn = state?.state === 'ready';

  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const enable = (): Promise<void> =>
    run(async () => {
      if (!provider) {
        throw new Error('Choose a provider first.');
      }
      if (apiKey.trim().length === 0) {
        setError('Paste the API key you created at the provider.');
        return;
      }
      if (!consentChecked) {
        setError('Tick the box to confirm you understand before enabling.');
        return;
      }
      const key: SecretKey = `ai.apiKey.${provider.id}`;
      await setSecret(key, apiKey.trim());
      await update({
        ai: {
          externalAnalysisEnabled: true,
          providerId: provider.id,
          consentGrantedAt: nowIso(),
          consentProviderId: provider.id,
          consentDisclosureVersion: provider.disclosureVersion,
          modelOverride: modelOverride.trim().length > 0 ? modelOverride.trim() : null,
        },
      });
      setApiKey('');
      setConsentChecked(false);
      setNotice('Food photo analysis is on.');
    });

  const disable = (): Promise<void> =>
    run(async () => {
      // Turning it off keeps the key so the user can switch it back on without retyping it.
      await update({ ai: { externalAnalysisEnabled: false } });
      setNotice('Food photo analysis is off. Nothing is sent anymore.');
    });

  const removeKey = (): Promise<void> =>
    run(async () => {
      const id = settings.ai.providerId ?? pickedProvider;
      await deleteSecret(`ai.apiKey.${id}`);
      await update({
        ai: { externalAnalysisEnabled: false, consentGrantedAt: null, consentProviderId: null, consentDisclosureVersion: null },
      });
      setNotice('The API key was removed from this phone.');
    });

  const changeProvider = (): Promise<void> =>
    run(async () => {
      // Changing provider voids consent: the new provider has its own disclosure the user must read.
      await update({
        ai: {
          externalAnalysisEnabled: false,
          providerId: null,
          consentGrantedAt: null,
          consentProviderId: null,
          consentDisclosureVersion: null,
        },
      });
      setNotice('Provider cleared. Choose one and read its data handling text again.');
    });

  return (
    <Card>
      <AppText variant="heading" style={{ marginBottom: 0 }}>
        Food photo analysis
      </AppText>
      <AppText variant="caption" muted>
        Off by default. Only your own meal photos are ever sent, and only after you turn this on
        here. Progress photos are never sent anywhere.
      </AppText>
      <AppText variant="caption" muted>
        {ESTIMATE_DISCLAIMER_TEXT}
      </AppText>
      <ErrorBanner error={error} />
      {notice ? <AppText variant="caption">{notice}</AppText> : null}

      {isOn && provider ? (
        <View style={{ marginTop: theme.spacing.sm }}>
          <AppText>Using {provider.displayName}.</AppText>
          <Button label="Turn analysis off" variant="secondary" onPress={() => void disable()} loading={busy} />
          <Button label="Change provider" variant="ghost" onPress={() => void changeProvider()} loading={busy} />
          <Button label="Remove the API key from this phone" variant="danger" onPress={() => void removeKey()} loading={busy} />
        </View>
      ) : (
        <View>
          <AppText variant="label" muted>
            1. Choose a provider
          </AppText>
          <Segmented
            options={AI_PROVIDER_CATALOG.map((info) => ({ value: info.id, label: info.displayName }))}
            value={pickedProvider}
            onChange={(value) => setPickedProvider(value as AiProviderId)}
          />

          {provider ? (
            <View style={{ marginTop: theme.spacing.sm }}>
              <AppText variant="label" muted>
                2. Read what this provider does with your photos
              </AppText>
              <AppText variant="caption" muted>
                {provider.dataHandlingSummary}
              </AppText>
              <AppText variant="label" muted>
                Cost and limits
              </AppText>
              <AppText variant="caption" muted>
                {provider.freeTierSummary}
              </AppText>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Read their terms"
                    variant="secondary"
                    onPress={() => void Linking.openURL(provider.docsUrl)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Get a free key"
                    variant="secondary"
                    onPress={() => void Linking.openURL(provider.apiKeyUrl)}
                  />
                </View>
              </View>

              <AppText variant="label" muted>
                3. Paste your API key
              </AppText>
              <TextField
                label="API key"
                value={apiKey}
                onChangeText={setApiKey}
                placeholder="Paste the key here"
              />
              <TextField
                label="Model override (advanced, optional)"
                value={modelOverride}
                onChangeText={setModelOverride}
                placeholder={provider.defaultModelId}
              />
              <AppText variant="caption" muted>
                Leave this empty to use {provider.defaultModelId}. Last checked {provider.verifiedOn}.
              </AppText>

              <AppText variant="label" muted>
                4. Confirm and enable
              </AppText>
              <Button
                label={`I understand my meal photos will be sent to ${provider.id}`}
                variant={consentChecked ? 'primary' : 'secondary'}
                onPress={() => setConsentChecked((current) => !current)}
                disabled={busy}
              />
              <Button
                label="Enable food photo analysis"
                onPress={() => void enable()}
                loading={busy}
                disabled={!consentChecked}
              />
            </View>
          ) : null}
        </View>
      )}

      {state && state.state !== 'ready' && state.state !== 'disabled' ? (
        <AppText variant="caption" muted>
          {state.state === 'no_provider'
            ? 'Choose a provider.'
            : state.state === 'no_consent'
              ? 'The consent needs to be given again for this provider.'
              : 'Add the API key for this provider.'}
        </AppText>
      ) : null}

    </Card>
  );
}