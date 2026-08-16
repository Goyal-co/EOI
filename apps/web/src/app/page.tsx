import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@goyal/auth";
import { getPortalForRole } from "@goyal/auth";
import { getPortalLoginHrefForHost } from "@goyal/auth/portals";
import type { UserRole } from "@goyal/types";

export default async function HomePage() {
  const session = await auth();
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
  if (session?.user?.role) {
    redirect(getPortalForRole(session.user.role as UserRole, host));
  }
  redirect(getPortalLoginHrefForHost("partner", host));
}
