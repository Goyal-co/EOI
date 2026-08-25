import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getLoginHrefForRequestHost, pickRequestHost } from "@goyal/auth/portals";

export const dynamic = "force-dynamic";

/** Unknown routes send anonymous users to that host's portal login. */
export default async function NotFound() {
  const headerStore = await headers();
  const host = pickRequestHost({
    host: headerStore.get("host"),
    forwardedHost: headerStore.get("x-forwarded-host"),
  });
  redirect(getLoginHrefForRequestHost(host));
}
