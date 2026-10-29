// Photos taken on a phone are often 4-10 MB each. A form with several of them is a very large upload, and on a slow
// connection or behind the hosting proxy it fails with "Failed to fetch". Pictures are made smaller here, in the browser,
// before they are sent; the readable detail of a document photo stays.

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // one file, after shrinking
export const MAX_TOTAL_BYTES = 20 * 1024 * 1024; // everything in one submit

export const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1) + ' MB';

const loadBitmap = (file) => {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not an image')); };
    img.src = url;
  });
};

// A JPEG/PNG over ~1.2 MB becomes a JPEG with the longest side at most maxSide. If anything goes wrong, or the result is not
// smaller, the original file is used as it is. PDFs and small pictures are returned untouched.
export async function shrinkImage(file, maxSide = 1800, quality = 0.82) {
  try {
    if (!file || !/^image\/(jpeg|jpg|png)$/i.test(file.type) || file.size <= 1.2 * 1024 * 1024) return file;
    const bmp = await loadBitmap(file);
    const w = bmp.width, h = bmp.height;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // a PNG with a see-through background would turn black as a JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    if (bmp.close) bmp.close();
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], String(file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
