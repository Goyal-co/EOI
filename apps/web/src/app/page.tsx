import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@goyal/auth";
import { getPortalForRole } from "@goyal/auth";
import { getLoginHrefForRequestHost, pickRequestHost } from "@goyal/auth/portals";
import type { UserRole } from "@goyal/types";

export default async function HomePage() {
  const session = await auth();
  const headerStore = await headers();
  const host = pickRequestHost({
    host: headerStore.get("host"),
    forwardedHost: headerStore.get("x-forwarded-host"),
  });
  if (session?.user?.role) {
    redirect(getPortalForRole(session.user.role as UserRole, host));
  }
  redirect(getLoginHrefForRequestHost(host));
}
