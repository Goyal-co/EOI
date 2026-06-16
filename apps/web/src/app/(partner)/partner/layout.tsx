"use client";

import { usePathname } from "next/navigation";
import { PartnerLayout } from "@/components/partner-layout";

const AUTH_PATHS = ["/partner/login", "/partner/register", "/partner/forgot-password", "/partner/pending-approval", "/partner/reset-password"];

export default function PartnerRootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isAuthPage) return <>{children}</>;
  return <PartnerLayout>{children}</PartnerLayout>;
}
