/**
 * INTEGRATION CONTRACT: CMP-SHELL-002
 * Purpose: the Today tab composes the header from the active journey and the three read-only
 *          module cards, plus the summary and settings exits.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { TodayScreen } from '../TodayScreen';
import { formatDisplayDate, todayLocal } from '@/shared/utils/dates';

jest.mock('@/modules/training', () => {
  const R = jest.requireActual('react');
  const RN = jest.requireActual('react-native');
  return {
    TodayExerciseCard: jest.fn(() => R.createElement(RN.Text, null, 'exercises-card')),
  };
});
jest.mock('@/modules/photos', () => {
  const R = jest.requireActual('react');
  const RN = jest.requireActual('react-native');
  return {
    useActiveJourney: jest.fn(() => ({
      journey: { id: 'j1', number: 5, startDate: '2026-10-01', status: 'active', completedOn: null, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' },
      dayNumber: 5,
      loading: false,
      reload: jest.fn(),
    })),
    TodayMilestoneCard: jest.fn(() => R.createElement(RN.Text, null, 'milestone-card')),
  };
});
jest.mock('@/modules/food', () => {
  const R = jest.requireActual('react');
  const RN = jest.requireActual('react-native');
  return {
    TodayFoodCard: jest.fn(() => R.createElement(RN.Text, null, 'food-card')),
  };
});
import { useActiveJourney } from '@/modules/photos';

const useActiveJourneyMock = useActiveJourney as jest.MockedFunction<typeof useActiveJourney>;

describe('TodayScreen (CMP-SHELL-002)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useActiveJourneyMock.mockReturnValue({
      journey: { id: 'j1', number: 5, startDate: '2026-10-01', status: 'active', completedOn: null, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' },
      dayNumber: 5,
      loading: false,
      reload: jest.fn(),
    });
  });

  it('renders the header with today\u2019s day number and date', async () => {
    await render(<TodayScreen />);
    await waitFor(() => expect(screen.getByText(/Day 5/)).toBeTruthy());
    expect(screen.getByText(formatDisplayDate(todayLocal()))).toBeTruthy();
  });

  it('renders all three module cards', async () => {
    await render(<TodayScreen />);
    expect(screen.getByText('exercises-card')).toBeTruthy();
    expect(screen.getByText('food-card')).toBeTruthy();
    expect(screen.getByText('milestone-card')).toBeTruthy();
  });

  it('offers today\u2019s summary and settings as exits', async () => {
    await render(<TodayScreen />);
    await waitFor(() => expect(screen.getByText("Today's summary")).toBeTruthy());
    expect(screen.getByText('Settings')).toBeTruthy();
  });
});