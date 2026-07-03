import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'payment-receipts'

export async function uploadPaymentReceipt(
  admin: SupabaseClient,
  responseId: string,
  file: File | Blob,
  fileNameHint?: string
): Promise<string> {
  const ext =
    fileNameHint?.split('.').pop()?.toLowerCase() ||
    (file instanceof File ? file.name.split('.').pop()?.toLowerCase() : null) ||
    'jpg'
  const safeExt = ext.replace(/[^a-z0-9]/gi, '') || 'jpg'
  const path = `payment-receipts/${responseId}/${Date.now()}.${safeExt}`

  const { error: uploadErr } = await admin.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  })
  if (uploadErr) throw uploadErr

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) throw new Error('public_url_failed')
  return data.publicUrl
}
