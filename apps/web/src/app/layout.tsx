import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Goyal Projects — EOI Platform",
    template: "%s | Goyal Projects",
  },
  description: "Luxury real estate Expression of Interest management platform for channel partners and customers.",
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
  openGraph: {
    title: "Goyal Projects — EOI Platform",
    description: "Luxury real estate Expression of Interest management platform",
    url: appUrl,
    siteName: "Goyal Projects",
    images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: "Goyal Projects" }],
    locale: "en_IN",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
