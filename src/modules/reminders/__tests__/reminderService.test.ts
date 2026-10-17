/** @jest-environment node */
import { createTestDb } from '@/shared/db/testing/createTestDb';
import { setDbForTesting } from '@/shared/db/database';
import { appEvents } from '@/shared/events/appEvents';
import { updateSettings } from '@/shared/settings/settingsRepository';

const mockScheduled = new Map<string, { body: string; route: string }>();
let mockPermission: 'granted' | 'denied' | 'undetermined' = 'granted';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({
    granted: mockPermission === 'granted',
    canAskAgain: mockPermission !== 'denied',
  })),
  requestPermissionsAsync: jest.fn(async () => ({
    granted: mockPermission === 'granted',
    canAskAgain: mockPermission !== 'denied',
  })),
  getAllScheduledNotificationsAsync: jest.fn(async () =>
    Array.from(mockScheduled.keys()).map((identifier) => ({
      identifier,
      content: { data: { identifier } },
    })),
  ),
  cancelScheduledNotificationAsync: jest.fn(async (identifier: string) => {
    mockScheduled.delete(identifier);
  }),
  scheduleNotificationAsync: jest.fn(async (request: {
    identifier: string;
    content: { body: string; data: { route: string } };
  }) => {
    mockScheduled.set(request.identifier, { body: request.content.body, route: request.content.data.route });
    return request.identifier;
  }),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

import {
  getNotificationPermissionState,
  initializeReminders,
  requestNotificationPermission,
  resetRemindersForTesting,
  syncReminders,
} from '../reminderService';
import { createExercise, saveSession } from '@/modules/training';
import { createFoodEntryFromPhoto } from '@/modules/food';

jest.mock('@/shared/files/photoStorage', () => ({
  savePhotoFromUri: jest.fn(async ({ id }: { id: string }) => ({
    relativePath: `food/${id}.jpg`,
    byteSize: 10,
  })),
  deletePhoto: jest.fn(async () => undefined),
  resolvePhotoUri: jest.fn((p: string) => `file:///${p}`),
  photoExists: jest.fn(async () => true),
}));

beforeEach(async () => {
  setDbForTesting(await createTestDb());
  mockScheduled.clear();
  mockPermission = 'granted';
  resetRemindersForTesting();
});

afterEach(() => {
  resetRemindersForTesting();
  setDbForTesting(null);
});

async function enableAll(): Promise<void> {
  await updateSettings({
    reminders: {
      exercise: { enabled: true, timeLocal: '23:00' },
      meals: {
        'meal-breakfast': { enabled: true, timeLocal: '23:01' },
        'meal-lunch': { enabled: false, timeLocal: '13:00' },
        'meal-snacks': { enabled: false, timeLocal: '16:30' },
        'meal-dinner': { enabled: false, timeLocal: '20:00' },
      },
      endOfDay: { enabled: true, timeLocal: '23:02' },
    },
  });
}

function identifiers(): string[] {
  return Array.from(mockScheduled.keys()).sort();
}

describe('getNotificationPermissionState / requestNotificationPermission (API-REM-003/004)', () => {
  it('maps the native status onto the three states', async () => {
    mockPermission = 'granted';
    expect(await getNotificationPermissionState()).toBe('granted');
    mockPermission = 'undetermined';
    expect(await getNotificationPermissionState()).toBe('undetermined');
    mockPermission = 'denied';
    expect(await getNotificationPermissionState()).toBe('denied');
  });

  it('requests and reports the resulting state', async () => {
    mockPermission = 'denied';
    expect(await requestNotificationPermission()).toBe('denied');
    mockPermission = 'granted';
    expect(await requestNotificationPermission()).toBe('granted');
  });
});

describe('syncReminders (API-FOOD-002, GAT-006)', () => {
  it('schedules nothing and cancels everything when mockPermission is missing', async () => {
    await enableAll();
    mockPermission = 'denied';
    await syncReminders();
    expect(mockScheduled.size).toBe(0);
  });

  it('produces an identical identifier set when run twice (idempotent, no duplicates)', async () => {
    await enableAll();
    await syncReminders();
    const first = identifiers();
    await syncReminders();
    expect(identifiers()).toEqual(first);
    expect(first.length).toBeGreaterThan(0);
  });

  it('schedules within a seven-day window', async () => {
    await enableAll();
    await syncReminders();
    const eod = identifiers().filter((id) => id.startsWith('rem:eod:'));
    expect(eod).toHaveLength(7);
  });

  it('skips today\'s exercise reminder once a session is completed', async () => {
    await enableAll();
    const today = new Date();
    const weekday = ((today.getDay() + 6) % 7) + 1;
    await createExercise({
      name: 'A',
      sets: 1,
      reps: 5,
      scheduleDays: [weekday] as never,
    });
    await saveSession({
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      status: 'completed',
      totalDurationSeconds: 60,
      results: [
        {
          exerciseId: null,
          exerciseName: 'A',
          plannedSets: 1,
          plannedReps: 5,
          plannedDurationSeconds: null,
          completedSets: 1,
          completedReps: 5,
          activeSeconds: 60,
          status: 'completed',
          intensity: null,
          sortOrder: 0,
        },
      ],
    });

    await syncReminders();
    const todayExercise = identifiers().find((id) => id.startsWith('rem:exercise:'));
    expect(todayExercise).toBeUndefined();
  });

  it('skips today\'s meal prompt once that meal is logged', async () => {
    await enableAll();
    await createFoodEntryFromPhoto({
      mealCategoryId: 'meal-breakfast',
      tempImageUri: 'file:///tmp/x.jpg',
      capturedAt: new Date().toISOString(),
    });
    await syncReminders();
    const breakfastToday = identifiers().filter((id) => id.startsWith('rem:meal:meal-breakfast:'));
    expect(breakfastToday).toHaveLength(6);
  });

  it('never throws when the database is unavailable', async () => {
    setDbForTesting(null);
    await expect(syncReminders()).resolves.toBeUndefined();
  });
});

describe('event-driven sync (API-REM-001)', () => {
  it('debounces a burst of events into a single refresh', async () => {
    jest.useFakeTimers();
    try {
      await enableAll();
      await initializeReminders();
      mockScheduled.clear();

      const handler = jest.fn();
      const off = appEvents.on('data.restored', handler);
      appEvents.emit('data.restored', {});
      appEvents.emit('data.restored', {});
      appEvents.emit('data.restored', {});
      off();

      // Nothing has run yet: the debounce window is still open.
      expect(mockScheduled.size).toBe(0);
      await jest.advanceTimersByTimeAsync(350);
      expect(mockScheduled.size).toBeGreaterThan(0);
    } finally {
      jest.useRealTimers();
    }
  });
});