/**
 * INTEGRATION CONTRACT: module index for `@/modules/reminders`
 * Purpose: the ONLY public surface of the reminders module.
 * Consumers: src/app/_layout.tsx and src/shell/** (A7)
 * Contract status: APPROVED
 */

// API-REM-001..004
export {
  getNotificationPermissionState,
  initializeReminders,
  requestNotificationPermission,
  syncReminders,
} from './reminderService';

// HOOK-REM-001
export { useReminderNotificationRouting } from './useReminderNotificationRouting';

// CMP-REM-001
export { ReminderSettingsSection } from './ReminderSettingsSection';

// TYPE-REM-001
export type { NotificationPermissionState } from './types';