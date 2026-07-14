// ============================================================
// クライアント用: スマホ写真（数MB・HEIC）を canvas で JPEG に再エンコード。
//   フルサイズのまま送るとサイズ超過・形式不一致でOCRが失敗するため、
//   最大幅を制限した JPEG の base64（プレフィックス無し）にして送る。
//   ブラウザ専用（document/Image/URL を使用）。
// ============================================================
export function fileToJpegBase64(file: File, maxW = 1280, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const w = img.naturalWidth || maxW
      const h = img.naturalHeight || maxW
      const scale = Math.min(1, maxW / w)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(w * scale))
      canvas.height = Math.max(1, Math.round(h * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('画像の変換に失敗しました')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      const base64 = dataUrl.split(',')[1] ?? ''
      if (!base64) { reject(new Error('画像の変換に失敗しました')); return }
      resolve(base64)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像を読み込めませんでした')) }
    img.src = url
  })
}
