import { redirect } from "next/navigation";
import { auth } from "@goyal/auth";
import { getPortalForRole } from "@goyal/auth";
import type { UserRole } from "@goyal/types";

export default async function HomePage() {
  const session = await auth();
  if (session?.user?.role) {
    redirect(getPortalForRole(session.user.role as UserRole));
  }
  redirect("/customer/login");
}
