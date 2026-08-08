const KEY_PREFIX = 'langbuddy-apply-receipt-draft:'

export type ApplyReceiptDraft = {
  postingId: string
  fileName: string
  fileType: string
  dataUrl: string
  paymentMethod?: string
  savedAt: number
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('read_failed'))
    reader.readAsDataURL(file)
  })
}

export function dataUrlToFile(dataUrl: string, fileName: string, fileType: string): File {
  const comma = dataUrl.indexOf(',')
  const header = comma >= 0 ? dataUrl.slice(0, comma) : ''
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const mime = fileType || header.match(/:(.*?);/)?.[1] || 'image/jpeg'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new File([bytes], fileName || 'receipt.jpg', { type: mime })
}

export function saveReceiptDraft(draft: ApplyReceiptDraft): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(`${KEY_PREFIX}${draft.postingId}`, JSON.stringify(draft))
  } catch {
    /* quota / private mode */
  }
}

export function loadReceiptDraft(postingId: string): ApplyReceiptDraft | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(`${KEY_PREFIX}${postingId}`)
    if (!raw) return null
    return JSON.parse(raw) as ApplyReceiptDraft
  } catch {
    return null
  }
}

export function clearReceiptDraft(postingId: string): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(`${KEY_PREFIX}${postingId}`)
  } catch {
    /* ignore */
  }
}
