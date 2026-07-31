'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { MainNav } from '../_components/main-nav'
import { useLocale } from '@/hooks/use-locale'

export function PrivacyClient() {
  const locale = useLocale()

  const isKo = locale === 'ko'

  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden relative">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[8%] -left-[8%] w-[35%] h-[35%] bg-primary/5 rounded-full blur-[100px] animate-blob" />
        <div className="absolute top-[45%] -right-[12%] w-[32%] h-[32%] bg-primary/4 rounded-full blur-[90px] animate-blob [animation-delay:2s]" />
      </div>

      <MainNav />
      <main className="relative z-10 py-10 md:py-16">
        <div className="mx-auto w-full max-w-3xl px-4 md:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors mb-8 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" aria-hidden />
            {isKo ? '홈으로' : 'Back to home'}
          </Link>

          <header className="mb-10 md:mb-14 space-y-3">
            <p className="text-xs md:text-sm font-black tracking-wider text-primary uppercase">
              LangBuddy
            </p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">
              {isKo ? '개인정보 처리방침' : 'Privacy Policy'}
            </h1>
            <p className="text-sm text-muted-foreground font-medium leading-relaxed">
              {isKo
                ? '시행일: 2026년 5월 21일'
                : 'Effective date: May 21, 2026'}
            </p>
          </header>

          <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm shadow-sm p-6 md:p-10 space-y-10">
            {isKo ? <KoreanSections /> : <EnglishSections />}
          </div>

          <p className="mt-10 text-center text-[11px] md:text-xs text-muted-foreground/70 font-semibold tracking-tight">
            &copy; 2026 LangBuddy
          </p>
        </div>
      </main>
    </div>
  )
}

function KoreanSections() {
  return (
    <>
      <Section title="1. 총칙">
        <p>
          LangBuddy(이하 “서비스”)는 「개인정보 보호법」 등 관련 법령을 준수하며,
          이용자의 개인정보를 안전하게 보호하기 위해 노력합니다. 본 방침은
          서비스가 처리하는 개인정보와 그 처리 방법을 설명합니다.
        </p>
      </Section>
      <Section title="2. 수집 항목 및 방법">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>회원 가입 및 인증:</strong> 이메일, 이름(또는 닉네임), 비밀번호
            또는 소셜 로그인 제공자가 전달하는 식별자(카카오 식별자 포함) 등
          </li>
          <li>
            <strong>프로필 정보:</strong> 성별, 국적, 모국어, 학습 언어 등
            이용자가 직접 입력하는 프로필 항목
          </li>
          <li>
            <strong>모임 신청 및 커뮤니케이션:</strong> 신청 폼 입력 내용,
            선택적 프로필·연락처 등 서비스 이용 과정에서 이용자가 직접 제공하는 정보
          </li>
          <li>
            <strong>서비스 이용 기록:</strong> 언어 교환 등 모임 참가 이력
          </li>
          <li>
            <strong>자동 수집:</strong> 접속 로그·기기 정보·서비스 이용 기록·쿠키 등
          </li>
        </ul>
      </Section>
      <Section title="3. 처리 목적">
        <ul className="list-disc pl-5 space-y-2">
          <li>회원 식별, 가입·탈퇴 관리, 부정 이용 방지</li>
          <li>언어 교환 등 모임 운영, 신청·참석 관련 안내 및 고객 지원</li>
          <li>서비스 제공·개선, 통계·분석(식별 불가 또는 최소 데이터 기준 준수)</li>
          <li>법령상 의무 이행 및 분쟁 대응</li>
        </ul>
      </Section>
      <Section title="4. 보관 및 이용 기간">
        <p>
          수집·이용 목적이 달성되거나 회원 탈퇴 시 지체 없이 파기합니다. 다만 관계
          법령에 따라 일정 기간 보관이 필요한 경우 해당 기간까지 보관할 수 있습니다.
        </p>
      </Section>
      <Section title="5. 제3자 제공">
        <p>
          원칙적으로 이용자 동의 없이 개인정보를 외부에 제공하지 않습니다. 예외적으로
          법령에 따른 요청이 있는 경우에는 그에 따라 제공될 수 있습니다.
        </p>
      </Section>
      <Section title="6. 처리 위탁 및 국외 이전">
        <p>
          안정적인 서비스 제공을 위해 클라우드·인증 등 인프라를 이용할 수 있습니다.
          이 경우 「개인정보 보호법」에 따라 위탁 업무 내용 및 수탁자를 관리합니다.
          국외로 이전되는 경우 해당 법령이 정하는 안전 조치를 이행합니다.
        </p>
      </Section>
      <Section title="7. 정보주체의 권리">
        <p>
          이용자는 개인정보 열람·정정·삭제·처리 정지 및 동의 철회를 요청할 수
          있습니다. 요청은 서비스 내 설정 또는 고객 지원 채널을 통해 가능한 범위에서
          신속히 처리합니다.
        </p>
      </Section>
      <Section title="8. 안전성 확보 조치">
        <ul className="list-disc pl-5 space-y-2">
          <li>전송 및 저장 시 적절한 암호화·접근 통제 적용</li>
          <li>최소 권한 원칙에 따른 내부 접근 관리</li>
          <li>보안 패치 및 모니터링을 통한 위협 관리 노력</li>
        </ul>
      </Section>
      <Section title="9. 쿠키">
        <p>
          서비스는 로그인 유지 등을 위해 쿠키 또는 유사 기술을 사용할 수 있습니다.
          브라우저 설정에서 쿠키 저장을 거부할 수 있으나 일부 기능이 제한될 수 있습니다.
        </p>
      </Section>
      <Section title="10. 처리방침 변경">
        <p>
          법령·서비스 변경에 따라 본 방침을 수정할 수 있으며, 중요한 변경 시에는
          합리적인 방법으로 안내합니다. 변경된 방침은 게시 또는 시행일로부터 적용됩니다.
        </p>
      </Section>
      <Section title="11. 개인정보 보호 책임자">
        <p>
          개인정보와 관련한 문의는 LangBuddy 고객 지원 또는 공식 채널(예: SNS)로
          연락해 주세요. 접수 즉시 성실히 답변하겠습니다.
        </p>
      </Section>
    </>
  )
}

function EnglishSections() {
  return (
    <>
      <Section title="1. Introduction">
        <p>
          LangBuddy (“we”, “the service”) respects your privacy. This Privacy Policy
          explains what personal information we process and how we protect it,
          consistent with applicable data protection laws and our commitment to users.
        </p>
      </Section>
      <Section title="2. Information We Collect">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Account registration:</strong> email, name or display name,
            password, or identifiers provided by authentication providers (including Kakao identifier) when you sign in.
          </li>
          <li>
            <strong>Profile information:</strong> gender, nationality, native language,
            and learning language that you provide when setting up your profile.
          </li>
          <li>
            <strong>Applications & community use:</strong> information you submit in
            forms, optional profile/contact details when using meetups.
          </li>
          <li>
            <strong>Participation history:</strong> records of language exchange
            meetups you have attended.
          </li>
          <li>
            <strong>Automatic data:</strong> device and log data, service usage metrics,
            and cookies or similar technologies.
          </li>
        </ul>
      </Section>
      <Section title="3. How We Use Information">
        <ul className="list-disc pl-5 space-y-2">
          <li>To create and maintain accounts and prevent misuse.</li>
          <li>To operate language-exchange activities, communicate about events, and support users.</li>
          <li>To improve the service (using aggregated or minimized data where possible).</li>
          <li>To comply with legal obligations and respond to disputes.</li>
        </ul>
      </Section>
      <Section title="4. Retention">
        <p>
          We retain data only as long as needed for the purposes above or until you delete
          your account, unless longer retention is required by law.
        </p>
      </Section>
      <Section title="5. Sharing">
        <p>
          We do not sell your personal information. We may disclose information when
          required by law or to protect the rights and safety of users.
        </p>
      </Section>
      <Section title="6. Processors & cross-border transfers">
        <p>
          We may use trusted infrastructure providers for hosting and authentication,
          governed by contracts and safeguards consistent with applicable law. Where data
          is transferred internationally, we take appropriate protections.
        </p>
      </Section>
      <Section title="7. Your rights">
        <p>
          Depending on your jurisdiction, you may request access, correction, deletion,
          restriction, or portability, and withdraw consent where processing is consent-based.
          Contact us via in-app channels or LangBuddy&apos;s official support and we will
          respond promptly where feasible.
        </p>
      </Section>
      <Section title="8. Security">
        <ul className="list-disc pl-5 space-y-2">
          <li>Encryption and access controls suitable for our systems.</li>
          <li>Internal access limited to legitimate operational needs.</li>
          <li>Ongoing monitoring and updates to reduce security risks.</li>
        </ul>
      </Section>
      <Section title="9. Cookies">
        <p>
          We may use cookies for session continuity and reliability. You can control
          cookies in your browser; some features may not work fully if cookies are disabled.
        </p>
      </Section>
      <Section title="10. Updates">
        <p>
          We may revise this Privacy Policy when our practices or the law changes. Material
          updates will be communicated in a reasonable way. The revised version applies from
          the posted effective date.
        </p>
      </Section>
      <Section title="11. Contact">
        <p>
          For privacy-related questions, please reach out through LangBuddy customer
          support or our official contact channels listed on this site or social profiles.
        </p>
      </Section>
    </>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3 border-b border-border/60 pb-8 last:border-0 last:pb-0">
      <h2 className="text-lg md:text-xl font-black tracking-tight text-foreground">
        {title}
      </h2>
      <div className="text-sm md:text-[15px] text-muted-foreground leading-relaxed space-y-3 font-medium [&_strong]:font-black [&_strong]:text-foreground/90">
        {children}
      </div>
    </section>
  )
}
