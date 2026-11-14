'use client'

/**
 * Resizes and compresses a picked image on the device and returns a JPEG data URL.
 * Images are stored inside Firestore documents (no Firebase Storage needed), so they are kept
 * small: avatars ~256 px (~15 KB), post photos ~900 px (~80 KB).
 */
export async function compressImage(file: File, maxSide: number, quality = 0.8, square = false): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read image')); i.src = url })
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight
    if (square) { const s = Math.min(sw, sh); sx = (sw - s) / 2; sy = (sh - s) / 2; sw = sh = s }
    const scale = Math.min(1, maxSide / Math.max(sw, sh))
    const c = document.createElement('canvas')
    c.width = Math.round(sw * scale); c.height = Math.round(sh * scale)
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height)
    let q = quality, out = c.toDataURL('image/jpeg', q)
    while (out.length > (square ? 60_000 : 250_000) && q > 0.4) { q -= 0.1; out = c.toDataURL('image/jpeg', q) }
    return out
  } finally { URL.revokeObjectURL(url) }
}
