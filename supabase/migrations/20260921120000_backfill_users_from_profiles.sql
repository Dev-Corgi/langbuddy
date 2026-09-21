-- profiles에는 있으나 public.users에 없는 계정 백필.
-- reports/praises FK(users.id) 때문에 신고 접수가 실패하던 문제 예방.
INSERT INTO public.users (id, name, onboarding_completed)
SELECT p.id, NULLIF(TRIM(p.name), ''), false
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = p.id
)
ON CONFLICT (id) DO NOTHING;
