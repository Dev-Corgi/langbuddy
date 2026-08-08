-- 현장/관리자 추가 참가자용 임시(게스트) 유저.
-- public.users.id → auth.users(id) FK이므로 auth.users에도 함께 생성한다.
-- 신고·아카이브는 form_responses.user_id(=guest id)로 식별.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_guest boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.is_guest IS
  '현장/관리자 추가 참가자용 임시 계정. auth는 로그인 불가용 placeholder. 신고·아카이브 식별용.';

CREATE INDEX IF NOT EXISTS users_is_guest_idx
  ON public.users (is_guest)
  WHERE is_guest = true;

-- 살아있는 walk-in 응답(user_id null)에 guest 백필
DO $$
DECLARE
  r RECORD;
  new_id uuid;
  guest_name text;
  guest_email text;
BEGIN
  FOR r IN
    SELECT id, answers
    FROM public.form_responses
    WHERE user_id IS NULL
      AND COALESCE(answers->>'_source', '') = 'admin_manual'
  LOOP
    new_id := gen_random_uuid();
    guest_name := COALESCE(
      NULLIF(TRIM(r.answers->>'name'), ''),
      NULLIF(TRIM(r.answers->>'_participant_name'), ''),
      NULLIF(TRIM(r.answers->>'이름'), ''),
      'Guest'
    );
    guest_email := 'walkin-' || new_id::text || '@guests.langbuddy.local';

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      is_sso_user,
      is_anonymous,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change_token_current
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_id,
      'authenticated',
      'authenticated',
      guest_email,
      crypt(gen_random_uuid()::text, gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'is_guest', true),
      jsonb_build_object('is_guest', true, 'name', guest_name),
      now(),
      now(),
      false,
      false,
      '',
      '',
      '',
      ''
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      new_id,
      new_id,
      jsonb_build_object('sub', new_id::text, 'email', guest_email, 'email_verified', true),
      'email',
      new_id::text,
      now(),
      now(),
      now()
    );

    -- handle_new_user trigger가 profiles를 만들 수 있음. 이름 정리 + users guest 행
    UPDATE public.profiles
    SET name = guest_name,
        name_en = guest_name
    WHERE id = new_id;

    INSERT INTO public.users (id, name, gender, nationality, onboarding_completed, is_guest)
    VALUES (
      new_id,
      guest_name,
      NULLIF(TRIM(r.answers->>'gender'), ''),
      NULLIF(TRIM(r.answers->>'nationality'), ''),
      false,
      true
    )
    ON CONFLICT (id) DO UPDATE
    SET
      name = EXCLUDED.name,
      gender = EXCLUDED.gender,
      nationality = EXCLUDED.nationality,
      is_guest = true;

    UPDATE public.form_responses
    SET user_id = new_id
    WHERE id = r.id;
  END LOOP;
END $$;
