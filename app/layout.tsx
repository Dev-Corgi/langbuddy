import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Footer } from "./_components/footer";
import { BottomNav } from "./_components/bottom-nav";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LangBuddy - 글로벌 소모임 & 번개 커뮤니티",
  description: "가볍게 즐기는 일상 속 특별한 만남, 번개 모임을 LangBuddy에서 만나보세요.",
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
      </body>
    </html>
  );
}
