import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Devotime",
  description: "A simple time card app to help you focus and track your work hours. Devote your time and boost your productivity with Devotime.",
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
