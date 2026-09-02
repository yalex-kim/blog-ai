import type { Metadata } from "next";
import { Geist, Nanum_Myeongjo } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Body face for generated articles only. Korean has no system serif, so the
// Hangul subset has to be loaded for 명조 to render at all — without it the
// text silently falls back to the UI sans.
const nanumMyeongjo = Nanum_Myeongjo({
  variable: "--font-serif-ko",
  weight: ["400", "700"],
  // No `subsets` here on purpose: Google does not expose Korean as a named
  // subset, so requesting one would filter the Hangul unicode-ranges out.
  // Omitting it serves every range, which requires preload: false.
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  title: "Blog AI",
  description: "업종별 블로그 글과 이미지를 생성하는 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${nanumMyeongjo.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
