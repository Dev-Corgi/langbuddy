import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Footer } from "./_components/footer";
import { BottomNav } from "./_components/bottom-nav";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LangBuddy - 글로벌 언어교환 & 스터디 커뮤니티",
  description: "외국인 친구들과 함께 즐기는 언어교환, 스터디, 번개 모임을 LangBuddy에서 만나보세요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-x-hidden`}
      >
        <Suspense fallback={null}>
          {children}
          <Footer />
          <BottomNav />
        </Suspense>
        <Toaster />
      </body>
    </html>
  );
}
