/**
 * INTEGRATION CONTRACT: CMP-SHELL-003
 * Purpose: the Settings composition and the four sections the shell own. External module sections
 *          are mocked; the shell sections render against a faked settings provider so no database
 *          is needed.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { SettingsScreen } from '../SettingsScreen';
import { ProfileSection } from '../sections/ProfileSection';
import { DisplaySection } from '../sections/DisplaySection';
import { SafetySection } from '../sections/SafetySection';
import { AboutSection } from '../sections/AboutSection';
import {
  HEALTH_DISCLAIMER_TEXT,
  LOCK_NOTE_TEXT,
  ESTIMATE_DISCLAIMER_TEXT,
} from '@/shared/constants/text';
import type { Profile } from '@/shared/types/profile';

jest.mock('@/modules/photos', () => {
  const R = jest.requireActual('react');
  const RN = jest.requireActual('react-native');
  return {
    JourneySettingsSection: jest.fn(() => R.createElement(RN.Text, null, 'journeys-section')),
  };
});
jest.mock('@/modules/reminders', () => {
  const R = jest.requireActual('react');
  const RN = jest.requireActual('react-native');
  return {
    ReminderSettingsSection: jest.fn(() => R.createElement(RN.Text, null, 'reminders-section')),
  };
});
jest.mock('@/modules/food', () => {
  const R = jest.requireActual('react');
  const RN = jest.requireActual('react-native');
  return {
    NutritionTargetsSettingsSection: jest.fn(() =>
      R.createElement(RN.Text, null, 'nutrition-section'),
    ),
  };
});
jest.mock('@/modules/nutrition-ai', () => {
  const R = jest.requireActual('react');
  const RN = jest.requireActual('react-native');
  return {
    AnalysisSettingsSection: jest.fn(() => R.createElement(RN.Text, null, 'analysis-section')),
  };
});
jest.mock('@/modules/backup', () => {
  const R = jest.requireActual('react');
  const RN = jest.requireActual('react-native');
  return {
    BackupSettingsSection: jest.fn(() => R.createElement(RN.Text, null, 'backup-section')),
  };
});
jest.mock('@/shared/data/profileRepository', () => ({
  getProfile: jest.fn(),
  updateProfile: jest.fn(async () => undefined),
}));
jest.mock('@/shared/settings/settingsRepository', () => ({
  getSettings: jest.fn(async () => ({
    display: { showCalorieEstimates: true },
    safety: { painAlertLevel: null },
    reminders: {
      exercise: { enabled: false, timeLocal: '08:00' },
      meals: {},
      endOfDay: { enabled: false, timeLocal: '20:00' },
    },
    nutrition: { targetCaloriesKcal: null, targetProteinGrams: null },
    ai: {
      externalAnalysisEnabled: false,
      providerId: null,
      consentGrantedAt: null,
      consentProviderId: null,
      consentDisclosureVersion: null,
      modelOverride: null,
    },
  })),
  updateSettings: jest.fn(async (patch: unknown) => patch),
  resetAiConsent: jest.fn(async () => ({})),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports -- pulled in after the mocks above.
import { SettingsProvider } from '@/shared/settings/SettingsProvider';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- pulled in after the mocks above.
import { getProfile } from '@/shared/data/profileRepository';

const getProfileMock = getProfile as jest.MockedFunction<typeof getProfile>;

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    heightCm: 170,
    unitSystem: 'metric',
    baselineWeightKg: null,
    onboardingCompleted: true,
    disclaimerAcknowledgedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('AboutSection', () => {
  it('renders the verbatim safety texts and the version', async () => {
    await render(<AboutSection />);
    expect(screen.getByText(HEALTH_DISCLAIMER_TEXT)).toBeTruthy();
    expect(screen.getByText(LOCK_NOTE_TEXT)).toBeTruthy();
    expect(screen.getByText(ESTIMATE_DISCLAIMER_TEXT)).toBeTruthy();
    expect(screen.getByText(/Version/)).toBeTruthy();
  });
});

describe('SafetySection', () => {
  it('renders the clinician helper text', async () => {
    await render(
      <SettingsProvider>
        <SafetySection />
      </SettingsProvider>,
    );
    expect(
      screen.getByText(
        'Only set this if your clinician gave you a number. The app never chooses one for you.',
      ),
    ).toBeTruthy();
  });
});

describe('DisplaySection', () => {
  it('renders the estimate disclaimer', async () => {
    await render(
      <SettingsProvider>
        <DisplaySection />
      </SettingsProvider>,
    );
    expect(screen.getByText(ESTIMATE_DISCLAIMER_TEXT)).toBeTruthy();
  });
});

describe('ProfileSection', () => {
  it('renders pre-filled from the stored profile', async () => {
    getProfileMock.mockResolvedValue(profile());
    const { getByLabelText } = await render(<ProfileSection />);
    await waitFor(() => expect(getByLabelText('Height')).toBeTruthy());
    expect(getByLabelText('Height').props.value).toBe('170');
  });
});

describe('SettingsScreen composition (CMP-SHELL-003)', () => {
  beforeEach(async () => {
    await render(
      <SettingsProvider>
        <SettingsScreen />
      </SettingsProvider>,
    );
  });

  it('composes every section in CONTRACT §5 order', async () => {
    await waitFor(() => expect(screen.getByText('journeys-section')).toBeTruthy());
    expect(screen.getByText('reminders-section')).toBeTruthy();
    expect(screen.getByText('nutrition-section')).toBeTruthy();
    expect(screen.getByText('analysis-section')).toBeTruthy();
    expect(screen.getByText('backup-section')).toBeTruthy();
  });

  it('renders the shell-owned sections', async () => {
    await waitFor(() => expect(screen.getByText('Profile & units')).toBeTruthy());
    expect(screen.getByText(HEALTH_DISCLAIMER_TEXT)).toBeTruthy();
    expect(screen.getByText(LOCK_NOTE_TEXT)).toBeTruthy();
    expect(screen.getAllByText(ESTIMATE_DISCLAIMER_TEXT).length).toBe(2);
  });
});
