import { redirect } from "next/navigation";

/** Unknown routes send anonymous users to Partner Portal login. */
export default function NotFound() {
  redirect("/partner/login");
}
