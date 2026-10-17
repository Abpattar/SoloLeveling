/**
 * INTEGRATION CONTRACT: API-PHOTO-011
 * Purpose: shares one progress photo through the Android share sheet. A locked photo can never be
 *          exported — the check happens before the file is even resolved (SEC-08).
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (API-PHOTO-011), SHARED_CONTRACT §10
 * Consumers: PhotoComparisonScreen.tsx, PhotosHomeScreen.tsx
 * Contract status: APPROVED
 */
import * as Sharing from 'expo-sharing';
import { toAppError } from '@/shared/errors/AppError';
import { fail, ok } from '@/shared/errors/result';
// CONTRACT: API-FILE-002 (A1) — private photo URI resolution
import { resolvePhotoUri } from '@/shared/files/photoStorage';
import { isPhotoVisible, getPhotoRelativePath } from '../data/photoRepository';
import type { Id, Result } from '@/shared/types/common';

/** API-PHOTO-011 */
export async function exportProgressPhoto(id: Id): Promise<Result<void>> {
  let visible: boolean;
  let relativePath: string;
  try {
    visible = await isPhotoVisible(id);
    if (!visible) {
      return fail('LOCKED', 'This photo is locked until its milestone.');
    }
    relativePath = await getPhotoRelativePath(id);
  } catch (e) {
    const error = toAppError(e, 'NOT_FOUND');
    return fail(error.code, error.message);
  }

  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      return fail('UNSUPPORTED', 'Sharing is not available on this device.');
    }
    await Sharing.shareAsync(resolvePhotoUri(relativePath), {
      mimeType: 'image/jpeg',
      dialogTitle: 'Share progress photo',
    });
    return ok(undefined);
  } catch (e) {
    // A share that the user cancels is not an error worth shouting about.
    const error = toAppError(e, 'STORAGE');
    return fail(error.code, error.message);
  }
}