import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Footer } from "./_components/footer";
import { BottomNav } from "./_components/bottom-nav";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { siteConfig } from "@/lib/site-config";
import type { CSSProperties } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${siteConfig.name} - 글로벌 언어교환 커뮤니티`,
  description: siteConfig.descriptionKo,
  metadataBase: siteConfig.siteUrl ? new URL(siteConfig.siteUrl) : undefined,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      style={
        siteConfig.primaryColor
          ? ({ '--primary': siteConfig.primaryColor, '--ring': siteConfig.primaryColor } as CSSProperties)
          : undefined
      }
    >
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
