# Hanabi deployment

The same application can now be deployed for Hanabi without changing LangBuddy's branding or data. Each Vercel project receives its own environment variables, and Hanabi must use a separate Supabase project.

## 1. Supabase

Create a project named `hanabi` in the intended Supabase organization and region. Recreate the current application schema before connecting Vercel. This repository currently contains incremental migrations, but it does not contain the original baseline schema, so the migrations alone cannot initialize a blank database.

Configure Auth after the schema is ready:

- Enable Kakao OAuth.
- Add the Hanabi Vercel production URL and `/auth/callback` redirect URL.
- Apply `supabase/templates/magic_link_otp.html` if email OTP is enabled.
- Create the `postings` storage bucket and its access policies.
- Set the first operator's `profiles.is_superadmin` value or configure `NEXT_PUBLIC_SUPER_ADMIN_EMAILS`.

## 2. Vercel

Create a separate Vercel project from this repository. Copy the keys from `.env.example` into Production, Preview, and Development as appropriate. Replace `NEXT_PUBLIC_APP_URL` with the actual Vercel production URL after the project is created.

The required runtime secrets are:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- Kakao keys when Kakao sign-in or messages are enabled
- Gmail credentials when email notifications are enabled

## 3. Branding later

- Change the displayed names and copy with the `NEXT_PUBLIC_CLUB_*` variables.
- Place the final logo in `public/` and set `NEXT_PUBLIC_CLUB_LOGO_URL=/logo-file-name.svg`.
- Set `NEXT_PUBLIC_CLUB_PRIMARY_COLOR` to a CSS color. The current LangBuddy color remains the fallback.
- Configure `NEXT_PUBLIC_INSTAGRAM_HANDLE` and `NEXT_PUBLIC_INSTAGRAM_URL` when the account is ready.

## 4. Acceptance flow

Verify the production flow in this order:

1. Kakao login and onboarding
2. language exchange schedule and form submission
3. bank transfer receipt and payment confirmation
4. QR download, delivery, and check-in
5. live seating assignment and round notification
6. My Page history, reports, and rewards
7. administrator and staff access restrictions
