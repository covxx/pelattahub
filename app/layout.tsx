import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ZebraPrinterProvider } from "@/contexts/ZebraPrinterContext";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PalettaHub | Warehouse Management System",
  description: "PalettaHub — PTI-first warehouse management for fresh produce.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
        <ZebraPrinterProvider>
          <div className="min-h-screen flex flex-col">
            <main className="flex-1">{children}</main>
            <footer className="border-t bg-muted/30">
              <div className="container mx-auto flex flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <div className="font-medium text-foreground">
                  © {new Date().getFullYear()} SRJLabs. All rights reserved.
                </div>
                <div className="flex items-center gap-4">
                  <Link href="/privacy" className="hover:text-foreground">
                    Privacy Policy
                  </Link>
                  <Link href="/terms" className="hover:text-foreground">
                    Terms &amp; Conditions
                  </Link>
                </div>
              </div>
            </footer>
          </div>
        </ZebraPrinterProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
