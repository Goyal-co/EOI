"use client";

import { usePathname } from "next/navigation";
import { CustomerLayout } from "@/components/customer-layout";
import { isShellAuthPath } from "@/lib/auth-paths";

const AUTH_PATHS = [
  "/customer/login",
  "/customer/welcome",
  "/customer/forgot-password",
  "/customer/reset-password",
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  if (isShellAuthPath(pathname, AUTH_PATHS)) return <>{children}</>;
  return <CustomerLayout>{children}</CustomerLayout>;
}
