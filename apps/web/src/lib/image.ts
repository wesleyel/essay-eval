import { MAX_PROMPT_IMAGE_LENGTH } from '@essay/domain';

/** 把题目图片缩放并压缩为 JPEG data URL，保证能存进 D1 单行 */
export async function compressImage(file: File, maxSide = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  for (let side = maxSide, quality = 0.85; side >= 400; side = Math.round(side * 0.75), quality -= 0.1) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', Math.max(quality, 0.5));
    if (dataUrl.length <= MAX_PROMPT_IMAGE_LENGTH) return dataUrl;
  }
  throw new Error('图片过大，请裁剪后再上传');
}
