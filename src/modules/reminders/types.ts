/**
 * INTEGRATION CONTRACT: TYPE-REM-001
 * Purpose: reminder module's own types. `PlannedReminder` is internal to the scheduler and never
 *          escapes this module.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (TYPE-REM-001), AGENT_02_PROMPT §3
 * Consumers: scheduler.ts, notifications.ts, reminderService.ts
 * Contract status: APPROVED
 */

/** TYPE-REM-001 */
export type NotificationPermissionState = 'granted' | 'denied' | 'undetermined';

export interface PlannedReminder {
  identifier: string;
  fireAt: Date;
  title: string;
  body: string;
  route: string;
}