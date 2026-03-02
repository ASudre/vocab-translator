import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { RegisterSW } from "./register-sw";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vocab Translator",
  description: "Learn vocabulary with interactive translations. Practice A1 level words and track your progress.",
  manifest: '/manifest.json',
  themeColor: '#4F46E5',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Vocab Translator',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon-192.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
