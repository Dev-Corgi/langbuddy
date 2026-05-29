/**
 * LangBuddy Supabase에 le_stamp/coupon 마이그레이션 적용.
 * Uses Supabase Management API (same token as MCP / Dashboard access tokens).
 *
 * Usage:
 *   $env:SUPABASE_ACCESS_TOKEN="sbp_..."
 *   $env:SUPABASE_PROJECT_REF="kjvcapmawmzmossumejm"
 *   node scripts/apply-le-coupon-migration.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvLocal() {
  try {
    const envText = readFileSync(resolve(root, '.env.local'), 'utf8')
    return Object.fromEntries(
      envText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
        .map((l) => {
          const i = l.indexOf('=')
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
        })
    )
  } catch {
    return {}
  }
}

function projectRefFromUrl(urlRaw) {
  if (!urlRaw) return ''
  try {
    return new URL(urlRaw).hostname.split('.')[0] || ''
  } catch {
    return ''
  }
}

const envLocal = loadEnvLocal()
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim()
const ref =
  process.env.SUPABASE_PROJECT_REF?.trim() ||
  projectRefFromUrl(envLocal.NEXT_PUBLIC_SUPABASE_URL)

if (!token) {
  console.error('Missing SUPABASE_ACCESS_TOKEN (Dashboard → Account → Access tokens)')
  process.exit(1)
}
if (!ref) {
  console.error('Missing SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL in .env.local')
  process.exit(1)
}

const migrationPaths = [
  resolve(root, 'supabase/migrations/20260529120000_le_stamp_and_coupon_atomic.sql'),
  resolve(root, 'supabase/migrations/20260529130000_le_coupon_refund_guard.sql'),
]
const query = migrationPaths.map((p) => readFileSync(p, 'utf8')).join('\n\n')

console.log('Applying migration to', ref, 'via Management API...')

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  }
)

const text = await res.text()
if (!res.ok) {
  console.error('Migration failed:', res.status, text)
  process.exit(1)
}

console.log('Migration applied successfully.')
if (text && text !== '[]') console.log(text)

const verifyRes = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
          AND column_name IN ('le_stamp_progress', 'le_reward_coupons')
        ORDER BY column_name;
      `,
    }),
  }
)
const verifyText = await verifyRes.text()
console.log('Columns:', verifyText)

const trigRes = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        SELECT tgname FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        WHERE c.relname = 'form_responses' AND NOT t.tgisinternal
          AND tgname IN (
            'form_responses_bump_le_stamp',
            'form_responses_consume_le_coupon',
            'form_responses_refund_le_coupon'
          )
        ORDER BY tgname;
      `,
    }),
  }
)
console.log('Triggers:', await trigRes.text())
