/**
 * INTEGRATION CONTRACT: CMP-SHELL-005
 * Purpose: first-launch gate. While onboarding is incomplete, every route redirects to the
 *          onboarding screen instead of rendering a screen that has no profile to read.
 * Canonical definition: SHARED_CONTRACT.md §5, SHARED_SYMBOL_REGISTRY.md (CMP-SHELL-005)
 * Consumers: src/app/_layout.tsx
 * Contract status: APPROVED
 */
import React from 'react';
import { Redirect } from 'expo-router';
// CONTRACT: API-SET-001 (A1) - the profile row, created lazily on first read
import { getProfile } from '@/shared/data/profileRepository';
// CONTRACT: CONST-NAV-001 (A1) - route builders
import { ROUTES } from '@/shared/navigation/routes';
// CONTRACT: HOOK-UI-002 (A1) - loads on mount, on focus and after a restore
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import type { ReactNode } from 'react';
import type { Profile } from '@/shared/types/profile';

export function SetupGate({ children }: { children: ReactNode }): React.JSX.Element | null {
  const load = React.useCallback(async (): Promise<Profile> => getProfile(), []);
  const { data, loading } = useFocusLoad(load, []);

  // Nothing is rendered until the answer is known: redirecting early would bounce a returning user
  // through onboarding on every cold start.
  if (loading || data === null) {
    return null;
  }

  if (!data.onboardingCompleted) {
    return <Redirect href={ROUTES.onboarding} />;
  }

  return <>{children}</>;
}
