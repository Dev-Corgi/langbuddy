import type { Metadata } from "next";
import type { ReactNode } from "react";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `개인정보 처리방침 | ${siteConfig.name}`,
  description:
    `${siteConfig.nameKo} 서비스의 개인정보 수집·이용 목적, 보관 기간 및 정보주체 권리 안내입니다.`,
};

export default function PrivacyLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
