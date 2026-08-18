"use client";

import { usePathname } from "next/navigation";
import { PartnerLayout } from "@/components/partner-layout";
import { isShellAuthPath } from "@/lib/auth-paths";

const AUTH_PATHS = [
  "/partner/login",
  "/partner/register",
  "/partner/forgot-password",
  "/partner/pending-approval",
  "/partner/reset-password",
];

export default function PartnerRootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  if (isShellAuthPath(pathname, AUTH_PATHS)) return <>{children}</>;
  return <PartnerLayout>{children}</PartnerLayout>;
}
