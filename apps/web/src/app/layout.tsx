import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

function getMetadataBase(): URL {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return new URL("http://localhost:3000");
  try {
    return new URL(raw);
  } catch {
    return new URL(`https://${raw}`);
  }
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
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
    url: getMetadataBase().toString(),
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
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
