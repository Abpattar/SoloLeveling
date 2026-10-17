/**
 * INTEGRATION CONTRACT: module index for `@/shell`
 * Purpose: the ONLY public surface of the shell. Route files import from here, never from a shell
 *          internal file.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-SHELL-001..005, API-SHELL-001)
 * Consumers: src/app/** (A7)
 * Contract status: APPROVED
 */

// CMP-SHELL-001..005
export { AppProviders } from './AppProviders';
export { TodayScreen } from './TodayScreen';
export { SettingsScreen } from './SettingsScreen';
export { OnboardingScreen } from './OnboardingScreen';
export { SetupGate } from './SetupGate';

// API-SHELL-001
export { bootstrapApp } from './bootstrap';
