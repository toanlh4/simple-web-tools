import { centerCrop, THUMB_QUALITY, THUMB_TYPE } from './crop';

export type ThumbReply = { ok: true; blob: Blob } | { ok: false; unsupported: boolean };

async function makeThumb(file: File): Promise<ThumbReply> {
  if (typeof OffscreenCanvas === 'undefined') return { ok: false, unsupported: true };
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const { x, y, source, target } = centerCrop(bitmap.width, bitmap.height);
    const canvas = new OffscreenCanvas(target, target);
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false, unsupported: true };
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, x, y, source, source, 0, 0, target, target);
    return { ok: true, blob: await canvas.convertToBlob({ type: THUMB_TYPE, quality: THUMB_QUALITY }) };
  } catch {
    return { ok: false, unsupported: false };
  } finally {
    bitmap?.close();
  }
}

self.onmessage = async (e: MessageEvent<File>) => {
  self.postMessage(await makeThumb(e.data));
};
