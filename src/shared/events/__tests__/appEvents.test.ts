/** @jest-environment node */
import { appEvents } from '../appEvents';

describe('appEvents (API-EVT-001)', () => {
  it('delivers a payload to every subscriber in subscription order', () => {
    const seen: string[] = [];
    const offA = appEvents.on('exercises.changed', () => seen.push('a'));
    const offB = appEvents.on('exercises.changed', () => seen.push('b'));
    appEvents.emit('exercises.changed', {});
    offA();
    offB();
    expect(seen).toEqual(['a', 'b']);
  });

  it('stops delivering after unsubscribe', () => {
    const handler = jest.fn();
    const off = appEvents.on('exercises.changed', handler);
    appEvents.emit('exercises.changed', {});
    off();
    appEvents.emit('exercises.changed', {});
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('isolates a throwing handler and does not stop the others', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const good = jest.fn();
    appEvents.on('exercises.changed', () => {
      throw new Error('handler exploded');
    });
    const off = appEvents.on('exercises.changed', good);
    expect(() => appEvents.emit('exercises.changed', {})).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
    off();
    warn.mockRestore();
  });

  it('tolerates a handler that unsubscribes during emission', () => {
    const calls: string[] = [];
    const offSecond = appEvents.on('exercises.changed', () => {
      calls.push('first');
      offSecond();
    });
    appEvents.on('exercises.changed', () => calls.push('second'));
    appEvents.emit('exercises.changed', {});
    expect(calls).toEqual(['first', 'second']);
  });

  it('carries typed payloads for data events', () => {
    const handler = jest.fn();
    const off = appEvents.on('food.entry.saved', handler);
    appEvents.emit('food.entry.saved', {
      entryId: 'e1',
      mealCategoryId: 'meal-lunch',
      localDate: '2026-10-12',
    });
    expect(handler).toHaveBeenCalledWith({
      entryId: 'e1',
      mealCategoryId: 'meal-lunch',
      localDate: '2026-10-12',
    });
    off();
  });
});