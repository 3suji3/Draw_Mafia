import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ConditionalThemeToggle } from "@/components/ui";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://draw-mafia.vercel.app"),
  title: "Draw Mafia",
  description: "실시간 멀티플레이 그림 추리 게임",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    url: "/",
    title: "Draw Mafia",
    description: "실시간 멀티플레이 그림 추리 게임",
    type: "website",
    siteName: "Draw Mafia",
    images: [
      {
        url: "/background_logo.png",
        width: 1200,
        height: 630,
        alt: "Draw Mafia 공유 썸네일",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Draw Mafia",
    description: "실시간 멀티플레이 그림 추리 게임",
    images: ["/background_logo.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/mafia-tab.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <ConditionalThemeToggle />
        {children}
      </body>
    </html>
  );
}
