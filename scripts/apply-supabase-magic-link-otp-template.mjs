/**
 * Applies hosted Supabase Auth "Magic link" email template as OTP-style mail
 * (body must include {{ .Token }} — see Supabase passwordless email docs).
 *
 * Requires a personal access token (not the anon key):
 *   https://supabase.com/dashboard/account/tokens
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_ACCESS_TOKEN="sbp_..."
 *   $env:SUPABASE_PROJECT_REF="kjvcapmawmzmossumejm"   # optional if NEXT_PUBLIC_SUPABASE_URL is set
 *   node scripts/apply-supabase-magic-link-otp-template.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function projectRefFromEnv() {
  const explicit = process.env.SUPABASE_PROJECT_REF?.trim()
  if (explicit) return explicit
  const urlRaw =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim()
  if (!urlRaw) return ''
  try {
    const host = new URL(urlRaw).hostname
    const sub = host.split('.')[0]
    return sub && sub !== 'localhost' ? sub : ''
  } catch {
    return ''
  }
}

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim()
const ref = projectRefFromEnv()

if (!token) {
  console.error(
    'Missing SUPABASE_ACCESS_TOKEN. Create one at Dashboard → Account → Access tokens.'
  )
  process.exit(1)
}
if (!ref) {
  console.error(
    'Missing project ref. Set SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL.'
  )
  process.exit(1)
}

const templatePath = path.join(
  __dirname,
  '..',
  'supabase',
  'templates',
  'magic_link_otp.html'
)
const content = fs.readFileSync(templatePath, 'utf8')

const subject =
  process.env.SUPABASE_MAGIC_LINK_SUBJECT?.trim() ||
  'Your LangBuddy sign-in code'

const body = {
  mailer_subjects_magic_link: subject,
  mailer_templates_magic_link_content: content,
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/config/auth`,
  {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }
)

const text = await res.text()
if (!res.ok) {
  console.error('PATCH failed:', res.status, text)
  process.exit(1)
}

console.log('OK: Magic link template updated to OTP style (' + res.status + ').')
if (text) console.log(text)
