import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VSL Studio — AD Media Solution",
  description: "Estudio de guiones VSL y reels con IA de AD Media Solution",
  openGraph: {
    title: "VSL Studio — AD Media Solution",
    description: "Estudio de guiones VSL y reels con IA de AD Media Solution",
    siteName: "VSL Studio",
    locale: "es_UY",
  },
};

export const viewport: Viewport = {
  themeColor: "#01327f",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppShell authEnabled={process.env.REQUIRE_AUTH === "true"}>{children}</AppShell>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
