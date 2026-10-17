/**
 * INTEGRATION CONTRACT: internal (A4 nutrition-ai) — the ONLY file importing expo-image-manipulator
 * Purpose: turn a private meal photo into a small, EXIF-free JPEG held in memory only. Nothing is
 *          written into the app's photo folders and nothing is logged.
 * Canonical definition: SHARED_CONTRACT.md §7 step 3
 * Consumers: estimateService.ts
 * Contract status: APPROVED (internal symbol, no registry ID)
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { AppError, toAppError } from '@/shared/errors/AppError';

const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.7;

export interface PreparedImage {
  base64: string;
  mimeType: 'image/jpeg';
}

/**
 * Uses the SDK 57 context API: `ImageManipulator.manipulate(uri)` loads the image, `resize` is applied
 * only when the long edge is over 1024 px, and `renderAsync().saveAsync({ base64: true })` returns the
 * JPEG bytes in memory. Re-encoding to JPEG drops EXIF metadata, so no location or device data travels.
 */
export async function prepareImageForAnalysis(imageUri: string): Promise<PreparedImage> {
  try {
    const context = ImageManipulator.manipulate(imageUri);
    const ref = await context.renderAsync();
    const longEdge = Math.max(ref.width, ref.height);
    if (longEdge > MAX_EDGE) {
      const scale = MAX_EDGE / longEdge;
      context.resize({
        width: Math.round(ref.width * scale),
        height: Math.round(ref.height * scale),
      });
    }
    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({
      compress: JPEG_QUALITY,
      format: SaveFormat.JPEG,
      base64: true,
    });
    if (typeof result.base64 !== 'string' || result.base64.length === 0) {
      throw new AppError('STORAGE', 'That photo could not be prepared for analysis.');
    }
    return { base64: result.base64, mimeType: 'image/jpeg' };
  } catch (e) {
    throw toAppError(e, 'STORAGE');
  }
}