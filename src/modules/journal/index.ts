/**
 * INTEGRATION CONTRACT: module index for `@/modules/journal`
 * Purpose: the ONLY public surface of the journal module. Imports no other module.
 * Consumers: journal screens (A6), progress dailySummary (A6)
 * Contract status: APPROVED
 */

// API-JRN-001..006
export {
  createJournalEntry,
  deleteJournalEntry,
  getJournalEntriesForDate,
  getJournalEntry,
  listJournalEntries,
  updateJournalEntry,
} from './data/journalRepository';

// CMP-JRN-001/002
export { JournalScreen } from './screens/JournalScreen';
export { JournalEntryScreen } from './screens/JournalEntryScreen';