import { prisma } from "@goyal/db";
import { withAuth, apiResponse, withApiRoute } from "@/lib/api";

export const GET = withApiRoute("admin.support.assignees", async () => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return apiResponse(admins);
});
