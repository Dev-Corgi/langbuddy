import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "개인정보 처리방침 | LangBuddy",
  description:
    "LangBuddy 서비스의 개인정보 수집·이용 목적, 보관 기간 및 정보주체 권리 안내입니다.",
};

export default function PrivacyLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
