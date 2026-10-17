/**
 * INTEGRATION CONTRACT: CMP-PHOTO-007
 * Purpose: the optional post-session photo prompt. "Skip" simply hides the card; it never blocks
 *          session completion and it never changes anything on its own.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-PHOTO-007), REQ-PHO-002, GAT-052
 * Consumers: src/modules/training/screens/SessionCompleteScreen.tsx (A2)
 * Contract status: APPROVED
 */
import React, { useState } from 'react';
import { router } from 'expo-router';
// CONTRACT: CONST-NAV-001 (A1) — route builder
import { ROUTES } from '@/shared/navigation/routes';
import { Card } from '@/shared/ui/Card';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';

export interface ProgressPhotoPromptCardProps {
  sessionId: string;
}

export function ProgressPhotoPromptCard({
  sessionId,
}: ProgressPhotoPromptCardProps): React.JSX.Element | null {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  return (
    <Card>
      <AppText variant="heading" style={{ marginBottom: 0 }}>
        Take a progress photo? (optional)
      </AppText>
      <AppText variant="caption" muted>
        It will be hidden until your next milestone day. Skipping is fine.
      </AppText>
      <Button
        label="Take photo"
        onPress={() => router.push(ROUTES.photoCapture(sessionId))}
      />
      <Button label="Skip" variant="ghost" onPress={() => setDismissed(true)} />
    </Card>
  );
}