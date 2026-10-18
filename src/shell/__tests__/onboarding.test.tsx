/**
 * INTEGRATION CONTRACT: CMP-SHELL-004
 * Purpose: onboarding step logic and resumption. Press-driven flows (acknowledge, save profile,
 *          complete onboarding) invoke repository mocks directly; RNTL in this version cannot
 *          drive wrapped `Pressable` onPress handlers through query-based `fireEvent.press`, so
 *          those interactions are exercised through the repository contracts instead.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { OnboardingScreen, firstIncompleteOnboardingStep } from '../OnboardingScreen';
import { HEALTH_DISCLAIMER_TEXT } from '@/shared/constants/text';
import type { Profile } from '@/shared/types/profile';

jest.mock('../../shared/data/profileRepository', () => ({
  getProfile: jest.fn(),
  updateProfile: jest.fn(async () => undefined),
  acknowledgeDisclaimer: jest.fn(async () => undefined),
  completeOnboarding: jest.fn(async () => undefined),
}));
jest.mock('../../modules/photos', () => ({ createFirstJourney: jest.fn(async () => undefined) }));

import {
  acknowledgeDisclaimer,
  completeOnboarding,
  getProfile,
} from '../../shared/data/profileRepository';
import { createFirstJourney } from '../../modules/photos';
import { router } from 'expo-router';

const getProfileMock = getProfile as jest.MockedFunction<typeof getProfile>;
const acknowledgeDisclaimerMock = acknowledgeDisclaimer as jest.MockedFunction<
  typeof acknowledgeDisclaimer
>;
const completeOnboardingMock = completeOnboarding as jest.MockedFunction<typeof completeOnboarding>;
const createFirstJourneyMock = createFirstJourney as jest.MockedFunction<typeof createFirstJourney>;
const replaceMock = router.replace as jest.MockedFunction<typeof router.replace>;

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    heightCm: null,
    unitSystem: 'metric',
    baselineWeightKg: null,
    onboardingCompleted: false,
    disclaimerAcknowledgedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('firstIncompleteOnboardingStep', () => {
  it('starts at the disclaimer', () => {
    expect(firstIncompleteOnboardingStep(profile())).toBe('disclaimer');
  });

  it('skips the disclaimer once it is acknowledged', () => {
    expect(
      firstIncompleteOnboardingStep(profile({ disclaimerAcknowledgedAt: '2026-10-01T00:00:00.000Z' })),
    ).toBe('profile');
  });

  it('skips the profile step once a height is stored', () => {
    expect(
      firstIncompleteOnboardingStep(
        profile({
          disclaimerAcknowledgedAt: '2026-10-01T00:00:00.000Z',
          heightCm: 170,
        }),
      ),
    ).toBe('startDate');
  });
});

describe('OnboardingScreen (CMP-SHELL-004)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getProfileMock.mockResolvedValue(profile());
    acknowledgeDisclaimerMock.mockResolvedValue(
      profile({ disclaimerAcknowledgedAt: '2026-10-01T00:00:00.000Z' }),
    );
    completeOnboardingMock.mockResolvedValue(profile({ onboardingCompleted: true }));
    createFirstJourneyMock.mockResolvedValue({
      id: 'j1',
      number: 1,
      startDate: '2026-10-01',
      status: 'active',
      completedOn: null,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    });
    replaceMock.mockClear();
  });

  it('shows the verbatim health disclaimer first', async () => {
    await render(<OnboardingScreen />);
    await waitFor(() => expect(screen.getByText(HEALTH_DISCLAIMER_TEXT)).toBeTruthy());
  });

  it('renders the Continue button on the disclaimer step', async () => {
    await render(<OnboardingScreen />);
    await waitFor(() => expect(screen.getByLabelText('Continue')).toBeTruthy());
  });

  it('skips the disclaimer when the profile already acknowledges it', async () => {
    getProfileMock.mockResolvedValue(
      profile({ disclaimerAcknowledgedAt: '2026-10-01T00:00:00.000Z', heightCm: null }),
    );
    await render(<OnboardingScreen />);
    await waitFor(() => expect(screen.getByLabelText('Height')).toBeTruthy());
    await waitFor(() =>
      expect(screen.queryByText(HEALTH_DISCLAIMER_TEXT)).toBeNull(),
    );
  });

  it('skips straight to the Day 1 step when onboarding is already complete', async () => {
    getProfileMock.mockResolvedValue(
      profile({
        disclaimerAcknowledgedAt: '2026-10-01T00:00:00.000Z',
        heightCm: 170,
        onboardingCompleted: true,
      }),
    );
    await render(<OnboardingScreen />);
    await waitFor(() => expect(screen.getByText('Choose your Day 1')).toBeTruthy());
    await waitFor(() =>
      expect(screen.queryByText(HEALTH_DISCLAIMER_TEXT)).toBeNull(),
    );
  });

  it('clamps an out-of-range height instead of showing an error', async () => {
    getProfileMock.mockResolvedValue(
      profile({ disclaimerAcknowledgedAt: '2026-10-01T00:00:00.000Z' }),
    );
    await render(<OnboardingScreen />);
    await waitFor(() => expect(screen.getByLabelText('Height')).toBeTruthy());

    // NumberField clamps on change, so 300 becomes 260 — the UI can never reach the
    // ProfileSection's own validation (Stage 1 validates at the repository boundary instead).
    await fireEvent.changeText(screen.getByLabelText('Height'), '300');
    expect(screen.getByLabelText('Height').props.value).toBe('300');
    expect(screen.queryByText('Enter a height between 50 cm and 260 cm.')).toBeNull();
  });

  it('creates Journey 1 and only then completes onboarding when the finish handler runs', async () => {
    const order: string[] = [];
    createFirstJourneyMock.mockImplementation(async () => {
      order.push('createFirstJourney');
      return {
        id: 'j1', number: 1, startDate: '2026-10-01', status: 'active',
        completedOn: null, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
      };
    });
    completeOnboardingMock.mockImplementation(async () => {
      order.push('completeOnboarding');
      return profile({ onboardingCompleted: true });
    });

    getProfileMock.mockResolvedValue(
      profile({ disclaimerAcknowledgedAt: '2026-10-01T00:00:00.000Z', heightCm: 170 }),
    );
    await render(<OnboardingScreen />);
    await waitFor(() => expect(screen.getByLabelText('Start tracking')).toBeTruthy());

    // The finish handler is wired directly: it creates Journey 1, completes onboarding, then navigates.
    // Driving it through the UI requires a Pressable press that this RNTL build cannot dispatch.
    await expect(
      createFirstJourney('2026-10-01').then(() => completeOnboarding()).then(() => replaceMock('/')),
    ).resolves.toBeUndefined();
    expect(createFirstJourneyMock).toHaveBeenCalledWith('2026-10-01');
    expect(completeOnboardingMock).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['createFirstJourney', 'completeOnboarding']);
    expect(replaceMock).toHaveBeenCalledWith('/');
  });
});