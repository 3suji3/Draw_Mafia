import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { ThemeToggle } from "@/components/ui";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Draw Mafia",
  description: "실시간 멀티플레이 그림 추리 게임",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={spaceGrotesk.className}>
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
