import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Devotime",
  description: "作業時間をシンプルに記録できるタイムカードアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
