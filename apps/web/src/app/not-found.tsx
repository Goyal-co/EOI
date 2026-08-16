import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getPortalLoginHrefForHost } from "@goyal/auth/portals";

/** Unknown routes send anonymous users to Partner Portal login. */
export default async function NotFound() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
  redirect(getPortalLoginHrefForHost("partner", host));
}
