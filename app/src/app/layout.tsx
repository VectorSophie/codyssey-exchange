import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Codyssey Exchange",
  description: "코디세이 학습 활동을 수요·공급·병목·진척 구조로 설명하는 학습 분석 도구",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3.5">
            <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
              <span className="inline-block h-4 w-1 rounded-[1px] bg-red-600" aria-hidden />
              Codyssey Exchange
            </Link>
            <nav className="flex gap-5 text-sm text-neutral-600">
              <Link href="/" className="hover:text-neutral-900">
                시장 개요
              </Link>
              <Link href="/quests" className="hover:text-neutral-900">
                과제 시세
              </Link>
              <Link href="/eval-market" className="hover:text-neutral-900">
                평가 시장
              </Link>
              <Link href="/me" className="hover:text-neutral-900">
                내 전략
              </Link>
              <Link href="/level-exam" className="hover:text-neutral-900">
                레벨과 시험
              </Link>
            </nav>
            <span className="ml-auto text-[11px] text-neutral-400">실제 데이터 연동 · 실제 화폐·투자수익을 다루지 않음</span>
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
