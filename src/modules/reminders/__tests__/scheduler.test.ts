/** @jest-environment node */
import { planReminders, REMINDER_TITLE } from '../scheduler';
import type { PlanRemindersInput } from '../scheduler';
import { DEFAULT_APP_SETTINGS } from '@/shared/constants/settings';
import { addDays, toLocalDate } from '@/shared/utils/dates';
import type { RemindersSettings } from '@/shared/types/settings';

const NOW = new Date(2026, 9, 12, 7, 0, 0, 0); // Mon 12 Oct 2026, 07:00 local
const TODAY = toLocalDate(NOW);

function settings(overrides: Partial<RemindersSettings> = {}): RemindersSettings {
  return {
    exercise: { enabled: true, timeLocal: '08:00' },
    meals: {
      'meal-breakfast': { enabled: true, timeLocal: '08:30' },
      'meal-lunch': { enabled: false, timeLocal: '13:00' },
      'meal-snacks': { enabled: false, timeLocal: '16:30' },
      'meal-dinner': { enabled: false, timeLocal: '20:00' },
    },
    endOfDay: { enabled: false, timeLocal: '21:00' },
    ...overrides,
  };
}

function input(overrides: Partial<PlanRemindersInput> = {}): PlanRemindersInput {
  return {
    now: NOW,
    settings: settings(),
    mealCategories: [
      { id: 'meal-breakfast', name: 'Breakfast' },
      { id: 'meal-lunch', name: 'Lunch' },
    ],
    exerciseDates: new Set([TODAY]),
    completedSessionToday: false,
    loggedCategoryIdsToday: new Set<string>(),
    mealPhotoCountToday: 0,
    ...overrides,
  };
}

function identifiers(overrides: Partial<PlanRemindersInput> = {}): string[] {
  return planReminders(input(overrides)).map((r) => r.identifier);
}

describe('rolling window', () => {
  it('plans exactly 7 local days, today plus six', () => {
    const plan = planReminders(
      input({
        settings: settings({
          meals: {
            'meal-breakfast': { enabled: true, timeLocal: '08:30' },
            'meal-lunch': { enabled: false, timeLocal: '13:00' },
          },
          endOfDay: { enabled: true, timeLocal: '21:00' },
        }),
      }),
    );
    const days = new Set(
      plan
        .filter((r) => r.identifier.startsWith('rem:eod:'))
        .map((r) => r.identifier.replace('rem:eod:', '')),
    );
    expect(days.size).toBe(7);
    expect(Array.from(days).sort()).toEqual(
      Array.from({ length: 7 }, (_, i) => addDays(TODAY, i)).sort(),
    );
  });

  it('honours a custom window length', () => {
    const plan = planReminders(
      input({ settings: settings({ endOfDay: { enabled: true, timeLocal: '21:00' } }), days: 3 }),
    );
    expect(plan.filter((r) => r.identifier.startsWith('rem:eod:'))).toHaveLength(3);
  });
});

describe('past times are dropped (GAT-006)', () => {
  it('skips today when its time has already passed', () => {
    const lateNow = new Date(2026, 9, 12, 23, 0, 0, 0);
    const plan = planReminders(input({ now: lateNow }));
    expect(plan.some((r) => r.identifier === `rem:exercise:${TODAY}`)).toBe(false);
    expect(plan.some((r) => r.identifier === `rem:eod:${TODAY}`)).toBe(false);
    // Tomorrow is still planned.
    expect(plan.some((r) => r.identifier.startsWith('rem:'))).toBe(true);
  });

  it('keeps today when its time is still in the future', () => {
    expect(identifiers()).toContain(`rem:exercise:${TODAY}`);
  });
});

describe('disabled types produce nothing', () => {
it('omits exercise reminders when disabled', () => {
const ids = identifiers({
settings: settings({ exercise: { enabled: false, timeLocal: '08:00' } }),
});
expect(ids.some((id) => id.startsWith('rem:exercise:'))).toBe(false);
});

  it('omits a disabled meal category but keeps an enabled one', () => {
    const ids = identifiers();
    expect(ids).toContain(`rem:meal:meal-breakfast:${TODAY}`);
    expect(ids.some((id) => id.startsWith('rem:meal:meal-lunch:'))).toBe(false);
  });

  it('omits end-of-day reminders when disabled', () => {
    expect(identifiers().some((id) => id.startsWith('rem:eod:'))).toBe(false);
  });

  it('omits meal reminders for a category with no settings entry', () => {
    const ids = identifiers({
      mealCategories: [{ id: 'meal-custom', name: 'Evening snack' }],
    });
    expect(ids.some((id) => id.includes('meal-custom'))).toBe(false);
  });
});

describe('completed work is not nagged about (GAT-007, REQ-REM-003)', () => {
it("skips today's exercise reminder once a session is completed", () => {
const tomorrow = addDays(TODAY, 1);
const ids = identifiers({
exerciseDates: new Set([TODAY, tomorrow]),
completedSessionToday: true,
});
expect(ids).not.toContain(`rem:exercise:${TODAY}`);
expect(ids).toContain(`rem:exercise:${tomorrow}`);
});

  it("skips today's meal prompt once that category is logged", () => {
    const ids = identifiers({ loggedCategoryIdsToday: new Set(['meal-breakfast']) });
    expect(ids).not.toContain(`rem:meal:meal-breakfast:${TODAY}`);
    expect(ids).toContain(`rem:meal:meal-breakfast:${addDays(TODAY, 1)}`);
  });
});

describe('exercise dates', () => {
  it('only plans days that actually have a scheduled exercise', () => {
    const tomorrow = addDays(TODAY, 1);
    const ids = identifiers({ exerciseDates: new Set([tomorrow]) });
    expect(ids).toContain(`rem:exercise:${tomorrow}`);
    expect(ids).not.toContain(`rem:exercise:${TODAY}`);
  });

it('plans nothing when no day has an exercise', () => {
expect(identifiers({ exerciseDates: new Set<string>() }).some((id) => id.startsWith('rem:exercise:'))).toBe(
false,
);
});
});

describe('identifiers and ordering', () => {
  it('uses the CONTRACT §9 identifier shapes', () => {
    const ids = identifiers({
      settings: settings({ endOfDay: { enabled: true, timeLocal: '21:00' } }),
    });
    expect(ids).toContain(`rem:exercise:${TODAY}`);
    expect(ids).toContain(`rem:meal:meal-breakfast:${TODAY}`);
    expect(ids).toContain(`rem:eod:${TODAY}`);
  });

  it('produces unique identifiers', () => {
    const plan = planReminders(
      input({ settings: settings({ endOfDay: { enabled: true, timeLocal: '21:00' } }) }),
    );
    expect(new Set(plan.map((r) => r.identifier)).size).toBe(plan.length);
  });

  it('is sorted by fire time', () => {
    const plan = planReminders(
      input({ settings: settings({ endOfDay: { enabled: true, timeLocal: '21:00' } }) }),
    );
    const times = plan.map((r) => r.fireAt.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('is idempotent: the same input always yields the same output (GAT-006)', () => {
    const args = { settings: settings({ endOfDay: { enabled: true, timeLocal: '21:00' } }) };
    expect(identifiers(args)).toEqual(identifiers(args));
  });

  it('uses the fixed app title on every reminder', () => {
    for (const reminder of planReminders(
      input({ settings: settings({ endOfDay: { enabled: true, timeLocal: '21:00' } }) }),
    )) {
      expect(reminder.title).toBe(REMINDER_TITLE);
    }
  });
});

describe('routes', () => {
  it('points each reminder at the right screen', () => {
    const plan = planReminders(
      input({ settings: settings({ endOfDay: { enabled: true, timeLocal: '21:00' } }) }),
    );
    const byPrefix = (prefix: string) => plan.find((r) => r.identifier.startsWith(prefix));
    expect(byPrefix('rem:exercise:')?.route).toBe('/');
    expect(byPrefix('rem:meal:')?.route).toBe('/food/capture?mealCategoryId=meal-breakfast');
    expect(byPrefix('rem:eod:')?.route).toBe(`/summary/${TODAY}`);
  });
});

describe('end-of-day body text', () => {
  const withEod = { endOfDay: { enabled: true, timeLocal: '21:00' } };

  it('reports nothing done today', () => {
    const plan = planReminders(
      input({
        settings: settings(withEod),
        mealPhotoCountToday: 0,
        exerciseDates: new Set([TODAY]),
        completedSessionToday: false,
      }),
    );
    expect(plan.find((r) => r.identifier === `rem:eod:${TODAY}`)?.body).toBe(
      '0 meal photos logged · exercise: not done today',
    );
  });

  it('reports a finished session and a singular photo', () => {
    const plan = planReminders(
      input({
        settings: settings(withEod),
        mealPhotoCountToday: 1,
        exerciseDates: new Set([TODAY]),
        completedSessionToday: true,
      }),
    );
    expect(plan.find((r) => r.identifier === `rem:eod:${TODAY}`)?.body).toBe(
      '1 meal photo logged · exercise: done',
    );
  });

  it('reports when nothing is scheduled', () => {
    const plan = planReminders(
      input({
        settings: settings(withEod),
        mealPhotoCountToday: 3,
        exerciseDates: new Set<string>(),
        completedSessionToday: false,
      }),
    );
    expect(plan.find((r) => r.identifier === `rem:eod:${TODAY}`)?.body).toBe(
      '3 meal photos logged · exercise: none scheduled',
    );
  });

  it('uses a neutral body for future days', () => {
    const tomorrow = addDays(TODAY, 1);
    const plan = planReminders(input({ settings: settings(withEod) }));
    expect(plan.find((r) => r.identifier === `rem:eod:${tomorrow}`)?.body).toBe(
      'Open the app to review your day',
    );
  });
});

describe('defaults are safe', () => {
  it('plans nothing when every reminder is off (DEFAULT_APP_SETTINGS)', () => {
    expect(planReminders(input({ settings: DEFAULT_APP_SETTINGS.reminders }))).toEqual([]);
  });
});