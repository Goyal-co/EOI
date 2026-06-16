"use client";

import { usePathname } from "next/navigation";
import { CustomerLayout } from "@/components/customer-layout";

const NO_LAYOUT_PATHS = ["/customer/login", "/customer/welcome"];

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const skipLayout = NO_LAYOUT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (skipLayout) return <>{children}</>;
  return <CustomerLayout>{children}</CustomerLayout>;
}
